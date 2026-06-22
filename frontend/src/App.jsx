import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import './App.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
function App() {
  const [currentUser, setCurrentUser] = useState(() => JSON.parse(localStorage.getItem('currentUser') || 'null'));
  const [view, setView] = useState('dashboard'); // 'dashboard', 'new-job', 'job-detail'
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [machines, setMachines] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch all initial data
  const loadDashboard = async () => {
    if (!currentUser) return;
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/dashboard`);
      if (!res.ok) throw new Error('Failed to load dashboard data');
      const data = await res.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ระบบหลังบ้านได้ กรุณาตรวจสอบการตั้งค่าเชื่อมต่อฐานข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const loadMetadata = async () => {
    if (!currentUser) return;
    try {
      const [machinesRes, usersRes] = await Promise.all([
        fetch(`${API_BASE_URL}/api/machines`),
        fetch(`${API_BASE_URL}/api/users`)
      ]);
      if (machinesRes.ok) setMachines(await machinesRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
    } catch (err) {
      console.error('Error loading metadata:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadDashboard();
      loadMetadata();
    }
  }, [currentUser]);

  const handleBackToDashboard = () => {
    setView('dashboard');
    setSelectedJobId(null);
    loadDashboard();
    loadMetadata();
  };

  const handleViewJob = (id) => {
    setSelectedJobId(id);
    setView('job-detail');
  };

  if (!currentUser) {
    return <LoginView onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  return (
    <div className="app-container">
      {/* Premium Header */}
      <header className="app-header">
        <div className="app-logo" onClick={handleBackToDashboard}>
          <span className="logo-icon"></span>
          <span className="gradient-text">ERP Job Manager</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div className="user-profile-header">
            <div className="user-info-text">
              <strong style={{ display: 'block', fontSize: '0.9rem' }}>{currentUser.name}</strong>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {currentUser.system_role === 'admin' ? '⚙️ Admin' : '👤 Technician'}
              </span>
            </div>
            <button 
              className="btn btn-secondary btn-sm" 
              onClick={() => {
                localStorage.removeItem('currentUser');
                setCurrentUser(null);
              }}
              style={{ padding: '8px 12px', fontSize: '0.8rem' }}
            >
              ออกจากระบบ
            </button>
          </div>
          <div style={{ borderLeft: '1px solid var(--border-color)', height: 30 }}></div>
          <div>
            {view === 'dashboard' ? (
              <button className="btn btn-primary" onClick={() => setView('new-job')}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                เปิดใบสั่งซ่อมใหม่
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={handleBackToDashboard}>
                ย้อนกลับหน้าหลัก
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      {loading && view === 'dashboard' && (
        <div style={{ textAlign: 'center', padding: '100px 0' }}>
          <div className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 600 }}>กำลังดาวน์โหลดข้อมูลระบบ...</div>
        </div>
      )}

      {error && (
        <div className="glass-panel animate-fade-in" style={{ borderColor: 'var(--danger-color)', marginBottom: 20 }}>
          <h3 style={{ color: 'var(--danger-color)', marginBottom: 8 }}>เกิดข้อผิดพลาด</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}</p>
          <button className="btn btn-secondary" style={{ marginTop: 15 }} onClick={loadDashboard}>ลองอีกครั้ง</button>
        </div>
      )}

      {!loading && !error && view === 'dashboard' && (
        <DashboardView
          data={dashboardData}
          onViewJob={handleViewJob}
          onOpenNewJob={() => setView('new-job')}
        />
      )}

      {view === 'new-job' && (
        <JobFormView
          machines={machines}
          users={users}
          onSuccess={handleBackToDashboard}
          onCancel={handleBackToDashboard}
        />
      )}

      {view === 'job-detail' && (
        <JobDetailView
          jobId={selectedJobId}
          onBack={handleBackToDashboard}
        />
      )}
    </div>
  );
}

function LoginView({ onLoginSuccess }) {
  const [empId, setEmpId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [forgotLoading, setForgotLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!empId.trim() || !password.trim()) {
      setError('กรุณากรอกรหัสพนักงานและรหัสผ่าน');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'การล็อกอินล้มเหลว');
      }
      localStorage.setItem('currentUser', JSON.stringify(data.user));
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setForgotLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ empId }),
      });
      const data = await res.json();
      if (res.ok) {
        setAdmins(data.admins || []);
        setShowForgotModal(true);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="login-wrapper animate-fade-in">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo-container">
            <span className="login-logo-icon"></span>
            <h2 className="gradient-text" style={{ fontSize: '1.8rem' }}>ERP Services</h2>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            กรุณาล็อกอินด้วยรหัสพนักงานเพื่อเริ่มใช้งาน
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 51, 102, 0.1)', border: '1px solid var(--danger-color)', padding: 12, borderRadius: 8, color: 'var(--danger-color)', marginBottom: 20, fontSize: '0.9rem' }}>
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label">รหัสพนักงาน (Employee ID)</label>
            <input
              type="text"
              className="form-control"
              placeholder="กรอกรหัสพนักงาน"
              value={empId}
              onChange={(e) => setEmpId(e.target.value)}
              required
            />
          </div>
          <div className="form-group" style={{ marginBottom: 10 }}>
            <label className="form-label">รหัสผ่าน (Password)</label>
            <input
              type="password"
              className="form-control"
              placeholder="กรอกรหัสผ่าน"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <div className="login-footer-actions">
            <button type="button" className="forgot-password-link" onClick={handleForgotPassword} disabled={forgotLoading}>
              {forgotLoading ? 'กำลังโหลด...' : 'ลืมรหัสผ่าน?'}
            </button>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 25 }} disabled={loading}>
            {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
          </button>
        </form>
      </div>

      {showForgotModal && (
        <div className="modal-overlay" onClick={() => setShowForgotModal(false)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h3>ลืมรหัสผ่าน?</h3>
              <button className="modal-close-btn" onClick={() => setShowForgotModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20, fontSize: '0.95rem' }}>
                รหัสผ่านเริ่มต้นของท่านคือ **รหัสพนักงาน** หากท่านเคยเปลี่ยนรหัสผ่านแล้วและลืม กรุณาติดต่อผู้ดูแลระบบด้านล่างนี้เพื่อขอรีเซ็ตรหัสผ่านใหม่:
              </p>
              <div className="admin-list">
                {admins.map((admin, idx) => (
                  <div key={idx} className="admin-item">
                    <strong>👤 {admin.name}</strong>
                    {admin.phone && <p>📞 เบอร์โทร: {admin.phone}</p>}
                    {admin.email && <p>✉️ อีเมล: {admin.email}</p>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -----------------------------------------------------------------------------
// DASHBOARD VIEW
// -----------------------------------------------------------------------------
function DashboardView({ data, onViewJob, onOpenNewJob }) {
  const [searchQuery, setSearchQuery] = useState('');

  if (!data) return null;
  const { summary, workloadBreakdown, recentJobs } = data;
  const activeWorkload = workloadBreakdown.filter((item) => item.count > 0);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredJobs = recentJobs.filter((job) => {
    if (!normalizedQuery) return true;

    const statusLabel =
      job.status === 'PENDING' ? 'รอดำเนินการ' :
      job.status === 'IN_PROGRESS' ? 'กำลังซ่อม' : 'เสร็จสิ้น';

    const searchableText = [
      job.job_id,
      job.machine_id,
      job.description,
      job.costcenter,
      statusLabel,
      job.main_technician?.name,
      job.electrician?.name,
      job.closed_at ? new Date(job.closed_at).toLocaleDateString('th-TH') : '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchableText.includes(normalizedQuery);
  });

  return (
    <div className="animate-fade-in">
      {/* 4 Stat Cards */}
      <section className="dashboard-grid">
        <div className="glass-panel stat-card">
          <span className="form-label">งานซ่อมทั้งหมด</span>
          <span className="stat-value">{summary.total}</span>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--warning-color)' }}>
          <span className="form-label" style={{ color: 'var(--warning-color)' }}>รอมอบหมาย / รอดำเนินการ</span>
          <span className="stat-value" style={{ color: 'var(--warning-color)', WebkitTextFillColor: 'var(--warning-color)', background: 'none' }}>{summary.pending}</span>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--primary-color)' }}>
          <span className="form-label" style={{ color: 'var(--primary-color)' }}>กำลังซ่อมแซม</span>
          <span className="stat-value" style={{ color: 'var(--primary-color)', WebkitTextFillColor: 'var(--primary-color)', background: 'none' }}>{summary.inProgress}</span>
        </div>
        <div className="glass-panel stat-card" style={{ borderLeft: '4px solid var(--success-color)' }}>
          <span className="form-label" style={{ color: 'var(--success-color)' }}>เสร็จสิ้นแล้ว</span>
          <span className="stat-value" style={{ color: 'var(--success-color)', WebkitTextFillColor: 'var(--success-color)', background: 'none' }}>{summary.completed}</span>
        </div>
      </section>

      {/* Main Grid: Left Jobs List, Right Extra Stats */}
      <div className="job-detail-grid">
        {/* Left Column: Recent Jobs */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, gap: 16 }}>
            <h2>รายการใบงานซ่อมล่าสุด</h2>
            <input
              type="search"
              className="form-control dashboard-search"
              placeholder="ค้นหาใบงาน, เครื่องจักร, ช่าง..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {recentJobs.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '60px' }}>
              <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>ไม่มีใบสั่งซ่อมบำรุงในฐานข้อมูล</p>
              <button className="btn btn-primary" onClick={onOpenNewJob}>เปิดใบสั่งซ่อมใบแรก</button>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="glass-panel" style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--text-secondary)' }}>ไม่พบใบงานที่ตรงกับคำค้นหา "{searchQuery}"</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {filteredJobs.map((job) => (
                <div key={job.job_id} className="glass-panel job-card" onClick={() => onViewJob(job.job_id)}>
                  <div>
                    <div className="job-card-header">
                      <span className={`badge ${job.status === 'PENDING' ? 'badge-pending' :
                          job.status === 'IN_PROGRESS' ? 'badge-inprogress' : 'badge-completed'
                        }`}>
                        {job.status === 'PENDING' ? 'รอดำเนินการ' :
                          job.status === 'IN_PROGRESS' ? 'กำลังซ่อม' : 'เสร็จสิ้น'}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        #{job.job_id}
                      </span>
                    </div>
                    <div className="job-card-body">
                      <h3 style={{ fontSize: '1.15rem', marginBottom: 8, fontWeight: 600 }}>
                        เครื่องจักร: {job.machine_id}
                      </h3>
                      {job.status === 'COMPLETED' && job.closed_at && (
                        <div style={{ fontSize: '0.85rem', color: 'var(--success-color)', marginBottom: 8 }}>
                          วันที่แล้วเสร็จ: {new Date(job.closed_at).toLocaleDateString('th-TH', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </div>
                      )}
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', height: '60px', marginBottom: 12 }}>
                        {job.description}
                      </p>
                      {job.costcenter && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 6 }}>
                          Cost Center: {job.costcenter}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="job-card-footer" style={{ fontSize: '0.8rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {job.main_technician ? (
                        <span style={{ color: 'var(--text-primary)' }}>
                          👤 ช่างหลัก: {job.main_technician.name}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>ไม่มีช่างหลัก</span>
                      )}
                      {job.electrician && (
                        <span style={{ color: 'var(--primary-color)' }}>
                          ⚡ ช่างไฟ: {job.electrician.name}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      📸 ก่อน: {job.images_count?.before_count || 0} | หลัง: {job.images_count?.after_count || 0}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Column: Mini Stats */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Workload per person panel */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }}>ปริมาณงานของแต่ละคน</h3>
            {activeWorkload.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>ไม่มีงานที่มอบหมายอยู่ในขณะนี้</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {activeWorkload.map((item, idx) => (
                  <div key={item.emp_id} style={{ borderBottom: idx < activeWorkload.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none', paddingBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                        👤 {item.name}
                      </span>
                      <span style={{ color: 'var(--primary-color)', fontSize: '0.9rem', fontWeight: 'bold' }}>{item.count} งาน</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// JOB FORM VIEW (Create new job with exact schema fields)
// -----------------------------------------------------------------------------
function JobFormView({ machines, users, onSuccess, onCancel }) {
  const [step, setStep] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [description, setDescription] = useState('');
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [mainTechnicianId, setMainTechnicianId] = useState('');
  const [electricianId, setElectricianId] = useState('');
  const [selectedImages, setSelectedImages] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Filter technicians
  const mainTechnicians = users; // Show all users as main technicians
  const electricians = users.filter(u => u.main_dept === 'ระบบไฟฟ้า'); // Show only users in ระบบไฟฟ้า

  // Filter machines based on search query
  const filteredMachines = machines.filter(machine => 
    machine.machine_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (machine.costcenter && machine.costcenter.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const handleImageChange = async (e) => {
    const files = Array.from(e.target.files);
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    try {
      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            return await imageCompression(file, options);
          } catch (err) {
            console.error('Image compression error:', err);
            return file;
          }
        })
      );
      setSelectedImages(prev => [...prev, ...compressedFiles]);
      const filePreviews = compressedFiles.map(file => URL.createObjectURL(file));
      setPreviews(prev => [...prev, ...filePreviews]);
    } catch (err) {
      console.error(err);
    }
  };

  const removeSelectedImage = (index) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMachine) {
      setSubmitError('กรุณาเลือกเครื่องจักร');
      setStep(1);
      return;
    }
    if (!description.trim()) {
      setSubmitError('กรุณากรอกอาการชำรุด');
      setStep(2);
      return;
    }
    if (!mainTechnicianId) {
      setSubmitError('กรุณาเลือกช่างเทคนิคหลัก');
      setStep(3);
      return;
    }

    setSubmitting(true);
    setSubmitError('');

    try {
      const formData = new FormData();
      formData.append('machineId', selectedMachine);
      formData.append('description', description);
      formData.append('mainTechnicianId', mainTechnicianId);
      formData.append('electricianId', electricianId);

      selectedImages.forEach(file => {
        formData.append('images', file);
      });

      const response = await fetch(`${API_BASE_URL}/api/jobs`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('เซิร์ฟเวอร์ตอบรับด้วยข้อผิดพลาดในการบันทึกข้อมูล');
      }

      onSuccess();
    } catch (err) {
      console.error(err);
      setSubmitError('เกิดข้อผิดพลาดในการบันทึกข้อมูลใบสั่งซ่อม กรุณาลองใหม่อีกครั้ง');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      <h2 style={{ marginBottom: 10 }} className="gradient-text">เปิดใบสั่งซ่อมบำรุงใหม่</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 30, fontSize: '0.9rem' }}>
        เลือกเครื่องจักร กรอกอาการชำรุด และระบุช่างหลักกับช่างไฟฟ้าเพื่อรับผิดชอบใบงานซ่อมบำรุง
      </p>

      {/* Steps indicator */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 40, borderBottom: '1px solid var(--border-color)', paddingBottom: 15 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: step === 1 ? 1 : 0.5 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: step === 1 ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>1</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>เลือกเครื่องจักร</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: step === 2 ? 1 : 0.5 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: step === 2 ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>2</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>อาการชำรุด</span>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', opacity: step === 3 ? 1 : 0.5 }}>
          <span style={{ width: 28, height: 28, borderRadius: '50%', background: step === 3 ? 'var(--primary-gradient)' : 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold' }}>3</span>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>มอบหมายงาน & รูปภาพ</span>
        </div>
      </div>

      {submitError && (
        <div style={{ background: 'rgba(255, 51, 102, 0.1)', border: '1px solid var(--danger-color)', padding: 12, borderRadius: 8, color: 'var(--danger-color)', marginBottom: 20, fontSize: '0.9rem' }}>
          ⚠️ {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        {/* Step 1: Select Machine */}
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 style={{ marginBottom: 15, fontSize: '1.1rem' }}>เลือกเครื่องจักรหลัก</h3>

            <div className="form-group" style={{ marginBottom: 20 }}>
              <input
                type="text"
                className="form-control"
                placeholder="🔍 ค้นหารหัสเครื่องจักร หรือ Cost Center..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ maxWidth: '400px' }}
              />
            </div>

            {machines.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                ไม่มีเครื่องจักรอยู่ในระบบ กรุณาเพิ่มเครื่องจักรลงในตาราง `machines` ก่อนทดสอบ
              </div>
            ) : filteredMachines.length === 0 ? (
              <div style={{ padding: '30px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                ไม่พบเครื่องจักรที่ตรงกับคำค้นหา
              </div>
            ) : (
              <div className="selection-grid" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '5px' }}>
                {filteredMachines.map((machine) => (
                  <div
                    key={machine.machine_id}
                    className={`selection-card ${selectedMachine === machine.machine_id ? 'selected' : ''}`}
                    onClick={() => setSelectedMachine(machine.machine_id)}
                  >
                    <div style={{ fontSize: '1.8rem', marginBottom: 8 }}>⚙️</div>
                    <strong style={{ display: 'block', fontSize: '0.9rem', marginBottom: 4 }}>
                      {machine.machine_id}
                    </strong>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Cost Center: {machine.costcenter}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 30 }}>
              <button
                type="button"
                className="btn btn-primary"
                disabled={machines.length === 0}
                onClick={() => {
                  if (!selectedMachine) {
                    setSubmitError('กรุณาเลือกเครื่องจักรเพื่อดำเนินการต่อ');
                  } else {
                    setSubmitError('');
                    setStep(2);
                  }
                }}
              >
                ถัดไป (กรอกรายละเอียด)
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Job Details */}
        {step === 2 && (
          <div className="animate-fade-in">
            <div className="form-group">
              <label className="form-label">รายละเอียดอาการชำรุดและงานซ่อมแซม</label>
              <textarea
                className="form-control"
                rows="8"
                placeholder="กรุณาเขียนอธิบายอาการชำรุดที่เป็นปัญหา เช่น ปั๊มน้ำมันเกียร์รั่วหรือมอเตอร์เกิดความร้อนสะสม เพื่อช่างจะได้เตรียมอุปกรณ์ได้ถูกต้อง"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 30 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>ย้อนกลับ</button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  if (!description.trim()) {
                    setSubmitError('กรุณากรอกอาการชำรุดเพื่อแจ้งซ่อม');
                  } else {
                    setSubmitError('');
                    setStep(3);
                  }
                }}
              >
                ถัดไป (มอบหมายช่าง & อัปโหลดรูป)
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Technicians & Image Upload */}
        {step === 3 && (
          <div className="animate-fade-in">

            {/* Tech Assignments */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 30 }}>
              <div className="form-group">
                <label className="form-label">ช่างซ่อมบำรุงหลัก (Main Technician) <span style={{ color: 'var(--danger-color)' }}>*</span></label>
                <select
                  className="form-control"
                  value={mainTechnicianId}
                  onChange={(e) => setMainTechnicianId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกช่างเทคนิคหลัก --</option>
                  {mainTechnicians.map(t => (
                    <option key={t.emp_id} value={t.emp_id}>
                      {t.name} ({t.position || t.emp_id}) [งานปัจจุบัน: {t.active_jobs_count || 0}]
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">ช่างไฟฟ้า (Electrician) <span style={{ color: 'var(--text-muted)' }}>(ถ้ามี)</span></label>
                <select
                  className="form-control"
                  value={electricianId}
                  onChange={(e) => setElectricianId(e.target.value)}
                >
                  <option value="">-- ไม่ระบุ / ไม่มีช่างไฟฟ้า --</option>
                  {electricians.map(t => (
                    <option key={t.emp_id} value={t.emp_id}>
                      {t.name} ({t.position || t.emp_id}) [งานปัจจุบัน: {t.active_jobs_count || 0}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Images list */}
            <div className="form-group">
              <label className="form-label">รูปถ่ายความเสียหายก่อนหน้าซ่อมแซม (BEFORE)</label>

              <label className="upload-zone" htmlFor="image-file-input">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" style={{ marginBottom: 8 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>กดอัปโหลดรูปภาพกล้องมือถือ / ไฟล์ภาพ</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>แนบได้สูงสุด 10 ภาพ (JPG, PNG)</div>
              </label>
              <input
                id="image-file-input"
                type="file"
                multiple
                accept="image/*"
                style={{ display: 'none' }}
                onChange={handleImageChange}
              />

              {previews.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  <div className="form-label">รูปภาพที่เลือก ({previews.length} ภาพ)</div>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {previews.map((preview, index) => (
                      <div key={index} style={{ position: 'relative', width: 90, height: 90, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                        <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        <button
                          type="button"
                          onClick={() => removeSelectedImage(index)}
                          style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(255, 51, 102, 0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 'bold' }}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40 }}>
              <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>ย้อนกลับ</button>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" className="btn btn-secondary" onClick={onCancel}>ยกเลิก</button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || !mainTechnicianId}
                >
                  {submitting ? 'กำลังบันทึกข้อมูล...' : 'บันทึกเปิดงานซ่อมบำรุง'}
                </button>
              </div>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

// -----------------------------------------------------------------------------
// JOB DETAIL VIEW (View details, update status, upload after-images to close)
// -----------------------------------------------------------------------------
function JobDetailView({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summaryText, setSummaryText] = useState('');
  const [selectedAfterImages, setSelectedAfterImages] = useState([]);
  const [afterPreviews, setAfterPreviews] = useState([]);
  const [closing, setClosing] = useState(false);
  const [actionError, setActionError] = useState('');
  const [uploadingImages, setUploadingImages] = useState({ BEFORE: false, AFTER: false });
  const [previewImage, setPreviewImage] = useState(null);

  const loadJobDetails = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}`);
      if (!res.ok) throw new Error('Failed to load job details');
      const data = await res.json();
      setJob(data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('ไม่สามารถเรียกข้อมูลใบสั่งซ่อมบำรุงได้');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (jobId) {
      loadJobDetails();
    }
  }, [jobId]);

  const handleStartJob = async () => {
    setActionError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/start`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error('Failed to update status');
      await loadJobDetails();
    } catch (err) {
      console.error(err);
      setActionError('ไม่สามารถเริ่มงานได้ กรุณาลองใหม่อีกครั้ง');
    }
  };

  const handleAfterImageChange = async (e) => {
    const files = Array.from(e.target.files);
    const options = {
      maxSizeMB: 1,
      maxWidthOrHeight: 1024,
      useWebWorker: true,
    };
    try {
      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            return await imageCompression(file, options);
          } catch (err) {
            console.error('Image compression error:', err);
            return file;
          }
        })
      );
      setSelectedAfterImages(prev => [...prev, ...compressedFiles]);
      const filePreviews = compressedFiles.map(file => URL.createObjectURL(file));
      setAfterPreviews(prev => [...prev, ...filePreviews]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleGalleryImageUpload = async (imageType, e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length === 0) return;

    setUploadingImages(prev => ({ ...prev, [imageType]: true }));
    setActionError('');

    try {
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };
      const compressedFiles = await Promise.all(
        files.map(async (file) => {
          try {
            return await imageCompression(file, options);
          } catch (err) {
            console.error('Image compression error:', err);
            return file;
          }
        })
      );

      const formData = new FormData();
      formData.append('image_type', imageType);
      compressedFiles.forEach(file => formData.append('images', file));

      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/images`, {
        method: 'POST',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to upload images');
      await loadJobDetails();
    } catch (err) {
      console.error(err);
      setActionError('ไม่สามารถอัปโหลดรูปภาพได้ กรุณาลองใหม่อีกครั้ง');
    } finally {
      setUploadingImages(prev => ({ ...prev, [imageType]: false }));
    }
  };

  const removeAfterPreview = (index) => {
    setSelectedAfterImages(prev => prev.filter((_, i) => i !== index));
    setAfterPreviews(prev => prev.filter((_, i) => i !== index));
  };

  const handleCloseJob = async (e) => {
    e.preventDefault();
    if (!summaryText.trim()) {
      setActionError('กรุณากรอกรายงานการปฏิบัติงานซ่อมแซม');
      return;
    }

    setClosing(true);
    setActionError('');

    try {
      const formData = new FormData();
      formData.append('summary', summaryText);

      selectedAfterImages.forEach(file => {
        formData.append('images', file);
      });

      const res = await fetch(`${API_BASE_URL}/api/jobs/${jobId}/close`, {
        method: 'PUT',
        body: formData
      });

      if (!res.ok) throw new Error('Failed to close job');

      setSummaryText('');
      setSelectedAfterImages([]);
      setAfterPreviews([]);
      await loadJobDetails();
    } catch (err) {
      console.error(err);
      setActionError('ไม่สามารถบันทึกปิดงานได้ กรุณาตรวจสอบข้อมูลและลองอีกครั้ง');
    } finally {
      setClosing(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <div className="gradient-text" style={{ fontSize: '1.5rem', fontWeight: 600 }}>กำลังดึงข้อมูลใบสั่งซ่อม...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel animate-fade-in" style={{ borderColor: 'var(--danger-color)' }}>
        <h3 style={{ color: 'var(--danger-color)', marginBottom: 10 }}>ข้อผิดพลาด</h3>
        <p>{error}</p>
        <button className="btn btn-secondary" style={{ marginTop: 15 }} onClick={onBack}>ย้อนกลับ</button>
      </div>
    );
  }

  const beforeImages = job.images?.filter(img => img.image_type === 'BEFORE') || [];
  const afterImages = job.images?.filter(img => img.image_type === 'AFTER') || [];

  return (
    <div className="animate-fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>ใบงานรหัส: #{job.job_id}</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 700, marginTop: 4 }}>
            เครื่องจักร: {job.machine_id}
          </h1>
        </div>
        <div>
          <span className={`badge ${job.status === 'PENDING' ? 'badge-pending' :
              job.status === 'IN_PROGRESS' ? 'badge-inprogress' : 'badge-completed'
            }`} style={{ fontSize: '0.9rem', padding: '8px 16px' }}>
            {job.status === 'PENDING' ? 'รอดำเนินการ' :
              job.status === 'IN_PROGRESS' ? 'กำลังซ่อมแซม' : 'ซ่อมเสร็จสิ้น (Completed)'}
          </span>
        </div>
      </div>

      {actionError && (
        <div style={{ background: 'rgba(255, 51, 102, 0.1)', border: '1px solid var(--danger-color)', padding: 12, borderRadius: 8, color: 'var(--danger-color)', marginBottom: 20 }}>
          ⚠️ {actionError}
        </div>
      )}

      {/* Grid: Left - Info & Image Gallery, Right - Control Actions */}
      <div className="job-detail-grid">

        {/* Left Side: General Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {/* Machine and job descriptions */}
          <div className="glass-panel">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 16 }}>ข้อมูลเครื่องจักรและอาการเสีย</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, marginBottom: 20 }}>
              <div>
                <span className="form-label">รหัสเครื่องจักร</span>
                <strong>{job.machine_id}</strong>
              </div>
              <div>
                <span className="form-label">ศูนย์ต้นทุน (Cost Center)</span>
                <strong>{job.costcenter || 'ไม่พบข้อมูล'}</strong>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <span className="form-label">รายละเอียดปัญหาซ่อมบำรุง</span>
              <p style={{ background: 'rgba(0,0,0,0.15)', padding: 16, borderRadius: 8, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', fontSize: '0.95rem' }}>
                {job.description}
              </p>
            </div>

            <div>
              <span className="form-label">วันที่แจ้งซ่อม</span>
              <span>{new Date(job.created_at).toLocaleString('th-TH')}</span>
            </div>
          </div>

          {/* Before & After Galleries */}
          <div className="glass-panel">
            <h3 style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: 12, marginBottom: 16 }}>ภาพตรวจสอบซ่อมบำรุง</h3>

            <div className="gallery-grid">
              {/* Before Column */}
              <div className="gallery-column">
                <div className="gallery-header">
                  <div className="gallery-title" style={{ color: 'var(--warning-color)' }}>
                    <span>📸</span> ภาพก่อนทำซ่อมบำรุง (Before)
                  </div>
                  <label
                    htmlFor="before-gallery-input"
                    className="btn btn-secondary btn-sm"
                    style={{ cursor: uploadingImages.BEFORE ? 'wait' : 'pointer', opacity: uploadingImages.BEFORE ? 0.7 : 1 }}
                  >
                    {uploadingImages.BEFORE ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพ'}
                  </label>
                  <input
                    id="before-gallery-input"
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleGalleryImageUpload('BEFORE', e)}
                    disabled={uploadingImages.BEFORE}
                  />
                </div>
                {beforeImages.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>ไม่มีรูปภาพถ่ายก่อนหน้าซ่อม</p>
                ) : (
                  <div className="image-grid">
                    {beforeImages.map(img => (
                      <div key={img.id} className="gallery-image-wrapper" onClick={() => setPreviewImage(img)} style={{ cursor: 'pointer' }}>
                        <img src={img.image_url} className="gallery-image" alt="Before maintenance" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* After Column */}
              <div className="gallery-column">
                <div className="gallery-header">
                  <div className="gallery-title" style={{ color: 'var(--success-color)' }}>
                    <span>✅</span> ภาพหลังซ่อมแซมเสร็จ (After)
                  </div>
                  <label
                    htmlFor="after-gallery-input"
                    className="btn btn-secondary btn-sm"
                    style={{ cursor: uploadingImages.AFTER ? 'wait' : 'pointer', opacity: uploadingImages.AFTER ? 0.7 : 1 }}
                  >
                    {uploadingImages.AFTER ? 'กำลังอัปโหลด...' : 'เพิ่มรูปภาพ'}
                  </label>
                  <input
                    id="after-gallery-input"
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => handleGalleryImageUpload('AFTER', e)}
                    disabled={uploadingImages.AFTER}
                  />
                </div>
                {afterImages.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '20px 0' }}>ยังไม่มีรูปภาพปิดงานซ่อมแซม</p>
                ) : (
                  <div className="image-grid">
                    {afterImages.map(img => (
                      <div key={img.id} className="gallery-image-wrapper" onClick={() => setPreviewImage(img)} style={{ cursor: 'pointer' }}>
                        <img src={img.image_url} className="gallery-image" alt="After maintenance" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {job.status === 'COMPLETED' && job.summary_notes && (
              <div style={{ marginTop: 24, padding: 16, background: 'rgba(0, 255, 135, 0.05)', border: '1px solid rgba(0, 255, 135, 0.15)', borderRadius: 10 }}>
                <span className="form-label" style={{ color: 'var(--success-color)' }}>สรุปผลการแก้ไขซ่อมบำรุง (Summary Notes)</span>
                <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{job.summary_notes}</p>
                {job.closed_at && (
                  <div style={{ marginTop: 10, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    ปิดใบงานซ่อมแซมเมื่อ: {new Date(job.closed_at).toLocaleString('th-TH')}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Execution Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Assigned Technicians list */}
          <div className="glass-panel">
            <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }}>ทีมช่างผู้รับผิดชอบ</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Main Tech */}
              <div>
                <span className="form-label" style={{ color: 'var(--text-primary)' }}>👤 ช่างซ่อมหลัก (Main Technician)</span>
                {job.main_technician ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', border: '1px solid var(--border-color)' }}>🛠️</div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>{job.main_technician.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ID: {job.main_technician.emp_id} {job.main_technician.phone && `| 📞 ${job.main_technician.phone}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ยังไม่ได้ระบุช่างหลัก</span>
                )}
              </div>

              {/* Electrician */}
              <div>
                <span className="form-label" style={{ color: 'var(--text-primary)' }}>⚡ ช่างไฟฟ้า (Electrician)</span>
                {job.electrician ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(0, 242, 254, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', border: '1px solid var(--primary-color)' }}>⚡</div>
                    <div>
                      <strong style={{ display: 'block', fontSize: '0.9rem' }}>{job.electrician.name}</strong>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        ID: {job.electrician.emp_id} {job.electrician.phone && `| 📞 ${job.electrician.phone}`}
                      </span>
                    </div>
                  </div>
                ) : (
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>ไม่ได้มอบหมายช่างไฟฟ้า</span>
                )}
              </div>
            </div>
          </div>

          {/* Action flow based on job status */}
          <div className="glass-panel" style={{ border: '1px solid var(--primary-color)' }}>
            <h3 style={{ marginBottom: 16, fontSize: '1.1rem' }} className="gradient-text">จัดการสถานะใบสั่งซ่อม</h3>

            {/* PENDING status -> Start Job button */}
            {job.status === 'PENDING' && (
              <div>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 20 }}>
                  ใบแจ้งซ่อมรอมอบหมายเรียบร้อยแล้ว ช่างซ่อมสามารถกดเริ่มดำเนินงานเมื่อเข้าจุดแก้ไขเครื่องจักรจริง
                </p>
                <button className="btn btn-primary" style={{ width: '100%' }} onClick={handleStartJob}>
                  ▶️ เริ่มปฏิบัติการซ่อม (IN_PROGRESS)
                </button>
              </div>
            )}

            {/* IN_PROGRESS status -> Close Job Form */}
            {job.status === 'IN_PROGRESS' && (
              <form onSubmit={handleCloseJob}>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                  งานกำลังอยู่ระหว่างดำเนินแก้ไขซ่อมบำรุง เมื่อเสร็จสิ้นแล้วกรุณากรอกรายงานและแนบภาพถ่ายหลังทำ (AFTER) เพื่อทำการปิดงาน
                </p>

                <div className="form-group">
                  <label className="form-label">รายงานผลการซ่อมบำรุง (Summary Notes)</label>
                  <textarea
                    className="form-control"
                    rows="4"
                    placeholder="ระบุสิ่งที่แก้ไข อะไหล่ชิ้นส่วนที่เปลี่ยน หรือข้อเสนอแนะในการดูแล..."
                    value={summaryText}
                    onChange={(e) => setSummaryText(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">รูปภาพหลังทำเสร็จ (AFTER)</label>
                  <label className="upload-zone" htmlFor="after-image-input" style={{ padding: 15 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary-color)" strokeWidth="2" style={{ marginBottom: 4 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    <span style={{ fontSize: '0.8rem', display: 'block' }}>แนบรูปถ่ายความสำเร็จ</span>
                  </label>
                  <input
                    id="after-image-input"
                    type="file"
                    multiple
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleAfterImageChange}
                  />

                  {afterPreviews.length > 0 && (
                    <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {afterPreviews.map((preview, idx) => (
                        <div key={idx} style={{ position: 'relative', width: 60, height: 60, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                          <img src={preview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="After preview" />
                          <button
                            type="button"
                            onClick={() => removeAfterPreview(idx)}
                            style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(255, 51, 102, 0.9)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ width: '100%', background: 'var(--success-gradient)' }}
                  disabled={closing}
                >
                  {closing ? 'กำลังบันทึกปิดงาน...' : '🏁 บันทึกสรุปและปิดใบงานซ่อมบำรุง'}
                </button>
              </form>
            )}

            {/* COMPLETED status */}
            {job.status === 'COMPLETED' && (
              <div style={{ textAlign: 'center', padding: '10px 0' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 10 }}>🎉</div>
                <strong style={{ color: 'var(--success-color)' }}>ใบงานซ่อมบำรุงปิดสมบูรณ์</strong>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 8 }}>
                  ใบงานนี้สำเร็จเสร็จสิ้นแล้ว ข้อมูลภาพถ่ายและบันทึกรายงานได้รับการบันทึกลงสู่ระบบ ERP ของโรงงานเรียบร้อยแล้ว
                </p>
              </div>
            )}

          </div>
        </div>

      </div>

      {previewImage && (
        <div className="modal-overlay" onClick={() => setPreviewImage(null)}>
          <div className="modal-card animate-fade-in" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ภาพตรวจสอบซ่อมบำรุง ({previewImage.image_type === 'BEFORE' ? 'ก่อนทำ' : 'หลังทำ'})</h3>
              <button className="modal-close-btn" onClick={() => setPreviewImage(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="modal-img-container">
                <img src={previewImage.image_url} className="modal-img" alt="Preview" />
              </div>
              <div className="modal-details">
                <div>
                  <span className="form-label" style={{ fontSize: '0.75rem' }}>ประเภทภาพ</span>
                  <strong>{previewImage.image_type === 'BEFORE' ? 'ก่อนหน้าซ่อมบำรุง (Before)' : 'หลังซ่อมแซมเสร็จ (After)'}</strong>
                </div>
                <div>
                  <span className="form-label" style={{ fontSize: '0.75rem' }}>เวลาอัปโหลด</span>
                  <span>{new Date(previewImage.uploaded_at).toLocaleString('th-TH')}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
