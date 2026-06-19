import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import pool from './db.js';
import { initMinio, uploadImage } from './minio.js';

dotenv.config();

const app = express();
const port = process.env.PORT;

// Enable CORS and JSON body parsing
app.use(cors());
app.use(express.json());

// Configure Multer for handling file uploads in memory
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit per image
  },
});

// Initialize MinIO bucket on startup
initMinio();

// -----------------------------------------------------------------------------
// API ENDPOINTS
// -----------------------------------------------------------------------------

// 1. GET /api/machines - List all machines
app.get('/api/machines', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM machines ORDER BY machine_id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching machines:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 2. GET /api/users - List all users (technicians)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT u.*, 
             COALESCE(job_counts.active_jobs_count, 0)::integer as active_jobs_count
      FROM users u
      LEFT JOIN (
        SELECT emp_id, COUNT(*) as active_jobs_count
        FROM (
          SELECT main_technician_id as emp_id FROM job_assignments ja JOIN jobs j ON ja.job_id = j.job_id WHERE j.status != 'COMPLETED'
          UNION ALL
          SELECT electrician_id as emp_id FROM job_assignments ja JOIN jobs j ON ja.job_id = j.job_id WHERE ja.electrician_id IS NOT NULL AND j.status != 'COMPLETED'
        ) active_assigns
        GROUP BY emp_id
      ) job_counts ON u.emp_id = job_counts.emp_id
      ORDER BY u.name ASC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 3. GET /api/dashboard - Get summary stats for the dashboard
app.get('/api/dashboard', async (req, res) => {
  try {
    // Total jobs and count by status
    const statsResult = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed
      FROM jobs
    `);

    // Active workload per technician
    const workloadResult = await pool.query(`
      SELECT u.emp_id, u.name, COALESCE(job_counts.active_jobs_count, 0)::integer as job_count
      FROM users u
      LEFT JOIN (
        SELECT emp_id, COUNT(*) as active_jobs_count
        FROM (
          SELECT main_technician_id as emp_id FROM job_assignments ja JOIN jobs j ON ja.job_id = j.job_id WHERE j.status != 'COMPLETED'
          UNION ALL
          SELECT electrician_id as emp_id FROM job_assignments ja JOIN jobs j ON ja.job_id = j.job_id WHERE ja.electrician_id IS NOT NULL AND j.status != 'COMPLETED'
        ) active_assigns
        GROUP BY emp_id
      ) job_counts ON u.emp_id = job_counts.emp_id
      ORDER BY job_count DESC, u.name ASC
    `);

    // Recent jobs
    const recentJobsResult = await pool.query(`
      SELECT j.*, m.costcenter
      FROM jobs j
      LEFT JOIN machines m ON j.machine_id = m.machine_id
      ORDER BY j.created_at DESC
      LIMIT 6
    `);

    const stats = statsResult.rows[0] || { total: 0, pending: 0, in_progress: 0, completed: 0 };
    const recentJobs = recentJobsResult.rows;

    // Fetch technicians and image counts for recent jobs
    for (let job of recentJobs) {
      const assignmentResult = await pool.query(`
        SELECT 
          ja.main_technician_id, u1.name as main_technician_name,
          ja.electrician_id, u2.name as electrician_name
        FROM job_assignments ja
        LEFT JOIN users u1 ON ja.main_technician_id = u1.emp_id
        LEFT JOIN users u2 ON ja.electrician_id = u2.emp_id
        WHERE ja.job_id = $1
      `, [job.job_id]);

      const assignment = assignmentResult.rows[0];
      job.main_technician = assignment ? { id: assignment.main_technician_id, name: assignment.main_technician_name } : null;
      job.electrician = assignment && assignment.electrician_id ? { id: assignment.electrician_id, name: assignment.electrician_name } : null;

      // Fetch before/after images count
      const imagesCountResult = await pool.query(`
        SELECT 
          COUNT(CASE WHEN image_type = 'BEFORE' THEN 1 END) as before_count,
          COUNT(CASE WHEN image_type = 'AFTER' THEN 1 END) as after_count
        FROM job_images
        WHERE job_id = $1
      `, [job.job_id]);
      job.images_count = imagesCountResult.rows[0];
    }

    res.json({
      summary: {
        total: parseInt(stats.total),
        pending: parseInt(stats.pending),
        inProgress: parseInt(stats.in_progress),
        completed: parseInt(stats.completed)
      },
      workloadBreakdown: workloadResult.rows.map(r => ({
        emp_id: r.emp_id,
        name: r.name,
        count: parseInt(r.job_count)
      })),
      recentJobs
    });

  } catch (err) {
    console.error('Error fetching dashboard stats:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 4. GET /api/jobs/:id - Fetch single job details including machine, assignments, and images
app.get('/api/jobs/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const jobResult = await pool.query(`
      SELECT j.*, m.costcenter
      FROM jobs j
      LEFT JOIN machines m ON j.machine_id = m.machine_id
      WHERE j.job_id = $1
    `, [id]);

    if (jobResult.rows.length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const job = jobResult.rows[0];

    // Fetch assigned technicians
    const assignmentResult = await pool.query(`
      SELECT 
        ja.main_technician_id, u1.name as main_technician_name, u1.phone as main_technician_phone, u1.email as main_technician_email,
        ja.electrician_id, u2.name as electrician_name, u2.phone as electrician_phone, u2.email as electrician_email
      FROM job_assignments ja
      LEFT JOIN users u1 ON ja.main_technician_id = u1.emp_id
      LEFT JOIN users u2 ON ja.electrician_id = u2.emp_id
      WHERE ja.job_id = $1
    `, [id]);

    const assignment = assignmentResult.rows[0];
    job.main_technician = assignment ? {
      emp_id: assignment.main_technician_id,
      name: assignment.main_technician_name,
      phone: assignment.main_technician_phone,
      email: assignment.main_technician_email
    } : null;

    job.electrician = assignment && assignment.electrician_id ? {
      emp_id: assignment.electrician_id,
      name: assignment.electrician_name,
      phone: assignment.electrician_phone,
      email: assignment.electrician_email
    } : null;

    // Fetch images
    const imagesResult = await pool.query(`
      SELECT image_id as id, image_url, image_type, uploaded_at
      FROM job_images
      WHERE job_id = $1
      ORDER BY uploaded_at ASC
    `, [id]);
    job.images = imagesResult.rows;

    res.json(job);
  } catch (err) {
    console.error(`Error fetching job ${id}:`, err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 5. POST /api/jobs - Open a new job (includes BEFORE images upload & technician assignments)
app.post('/api/jobs', upload.array('images', 10), async (req, res) => {
  const client = await pool.connect();
  try {
    const { machineId, description, mainTechnicianId, electricianId } = req.body;
    
    await client.query('BEGIN');

    // 1. Insert new job
    const jobInsertQuery = `
      INSERT INTO jobs (machine_id, description, status)
      VALUES ($1, $2, 'PENDING')
      RETURNING job_id
    `;
    const jobResult = await client.query(jobInsertQuery, [machineId, description]);
    const jobId = jobResult.rows[0].job_id;

    // 2. Insert assignments
    const assignmentQuery = `
      INSERT INTO job_assignments (job_id, main_technician_id, electrician_id)
      VALUES ($1, $2, $3)
    `;
    await client.query(assignmentQuery, [jobId, mainTechnicianId, electricianId || null]);

    // 3. Upload BEFORE images to MinIO and insert into db
    if (req.files && req.files.length > 0) {
      const imageQuery = `
        INSERT INTO job_images (job_id, image_url, image_type)
        VALUES ($1, $2, 'BEFORE')
      `;
      for (const file of req.files) {
        // Upload to MinIO
        const imageUrl = await uploadImage(file);
        // Save to Database
        await client.query(imageQuery, [jobId, imageUrl]);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, jobId, message: 'Job created successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating job:', err);
    res.status(500).json({ error: 'Failed to create job' });
  } finally {
    client.release();
  }
});

// 6. PUT /api/jobs/:id/close - Close a job (with AFTER images and summary notes)
app.put('/api/jobs/:id/close', upload.array('images', 10), async (req, res) => {
  const { id } = req.params;
  const { summary } = req.body;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Check if job exists
    const checkJob = await client.query('SELECT job_id FROM jobs WHERE job_id = $1', [id]);
    if (checkJob.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Job not found' });
    }

    // 1. Update job details
    const closeQuery = `
      UPDATE jobs 
      SET status = 'COMPLETED', closed_at = CURRENT_TIMESTAMP, summary_notes = $1
      WHERE job_id = $2
    `;
    await client.query(closeQuery, [summary, id]);

    // 2. Upload AFTER images to MinIO and insert path to db
    if (req.files && req.files.length > 0) {
      const imageQuery = `
        INSERT INTO job_images (job_id, image_url, image_type)
        VALUES ($1, $2, 'AFTER')
      `;
      for (const file of req.files) {
        // Upload to MinIO
        const imageUrl = await uploadImage(file);
        // Save to Database
        await client.query(imageQuery, [id, imageUrl]);
      }
    }

    await client.query('COMMIT');
    res.json({ success: true, message: 'Job closed successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`Error closing job ${id}:`, err);
    res.status(500).json({ error: 'Failed to close job' });
  } finally {
    client.release();
  }
});

// 7. PUT /api/jobs/:id/start - Update job status to IN_PROGRESS
app.put('/api/jobs/:id/start', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query(`
      UPDATE jobs
      SET status = 'IN_PROGRESS'
      WHERE job_id = $1
    `, [id]);
    res.json({ success: true, message: 'Job status updated to IN_PROGRESS' });
  } catch (err) {
    console.error(`Error starting job ${id}:`, err);
    res.status(500).json({ error: 'Failed to start job' });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`ERP Backend Server running on port ${port}`);
});
