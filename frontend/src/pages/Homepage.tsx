import React, { useEffect, useState } from 'react';
import { Button, Typography, message, Spin, Tooltip } from 'antd';
import { getCurrentUsername, clearLoggedIn } from '../auth';
import { PlusOutlined, DeleteOutlined, EditOutlined, FolderOpenOutlined } from '@ant-design/icons';
import './Homepage.css';

const { Title } = Typography;

interface Workflow {
  id: number;
  name: string;
  data_prep: string;
  analysis: string;
  visualisation: string;
}

const Homepage: React.FC<{ onSelectWorkflow: (workflow: Workflow) => void, onCreateWorkflow: (workflow: Workflow) => void }> = ({ onSelectWorkflow, onCreateWorkflow }) => {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);
  const username = getCurrentUsername();

  const fetchWorkflows = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/workflows?username=${username}`);
      if (!res.ok) throw new Error('Failed to fetch workflows');
      const data = await res.json();
      setWorkflows(data);
    } catch (err) {
      message.error('Could not load workflows');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
    // eslint-disable-next-line
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('http://localhost:8000/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Untitled Workflow', username }),
      });
      if (!res.ok) throw new Error('Failed to create workflow');
      const workflow = await res.json();
      setWorkflows([workflow, ...workflows]);
      onCreateWorkflow(workflow);
    } catch (err) {
      message.error('Could not create workflow');
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const res = await fetch(`http://localhost:8000/workflows/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete workflow');
      setWorkflows(workflows.filter(w => w.id !== id));
      message.success('Workflow deleted');
    } catch (err) {
      message.error('Could not delete workflow');
    }
  };

  const handleSignOut = () => {
    clearLoggedIn();
    window.location.href = '/login';
  };

  return (
    <div className="homepage-root">
      <button className="homepage-signout" onClick={handleSignOut}>Sign Out</button>
      <div className="homepage-welcome">
        Welcome, <span style={{ color: '#6366f1' }}>{username}</span>!
      </div>
      <div className="homepage-subtitle">
        Your personal workflow dashboard. Create, manage, and launch your data projects with style.
      </div>
      {loading ? (
        <Spin size="large" style={{ marginTop: 64 }} />
      ) : (
        <>
          {workflows.length === 0 ? (
            <div className="homepage-empty">
              <img src="/vite.svg" alt="No workflows" className="homepage-empty-illustration" />
              <div>You have no workflows yet.<br />Click the <b>+</b> button to create your first workflow!</div>
            </div>
          ) : (
            <div className="homepage-workflow-list">
              {workflows.map(item => (
                <div className="homepage-workflow-card" key={item.id}>
                  <div className="homepage-workflow-icon">
                    <FolderOpenOutlined style={{ fontSize: 32, color: '#fff' }} />
                  </div>
                  <div className="homepage-workflow-title" onClick={() => onSelectWorkflow(item)}>
                    {item.name}
                  </div>
                  <div className="homepage-workflow-actions">
                    <Tooltip title="Edit Workflow">
                      <Button shape="circle" icon={<EditOutlined />} onClick={() => onSelectWorkflow(item)} />
                    </Tooltip>
                    <Tooltip title="Delete Workflow">
                      <Button shape="circle" danger icon={<DeleteOutlined />} onClick={() => handleDelete(item.id)} />
                    </Tooltip>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
      <button className="homepage-create-fab" onClick={handleCreate} title="Create Workflow">
        <PlusOutlined />
      </button>
    </div>
  );
};

export default Homepage; 