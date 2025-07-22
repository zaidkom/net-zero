import React, { useState, useEffect } from "react";
import { Typography, Button, message } from "antd";
import { clearLoggedIn } from '../auth';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/Layout';

const { Title } = Typography;

interface DataVisualisationProps {
  workflowId?: string;
}

const DataVisualisation: React.FC<DataVisualisationProps> = ({ workflowId }) => {
  const navigate = useNavigate();
  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };

  const [saveLoading, setSaveLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  // Mark dirty on workflowId change (placeholder for future extensibility)
  useEffect(() => { setDirty(true); }, [workflowId]);

  const saveWorkflow = async () => {
    if (!workflowId) return;
    setSaveLoading(true);
    try {
      await fetch(`http://localhost:8000/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visualisation: '' }), // Placeholder for now
      });
      setDirty(false);
      setJustSaved(true);
      message.success('Workflow saved!');
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      message.error('Failed to save workflow');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Data Visualisation</Title>
          <Button type="primary" style={{ fontWeight: 700, borderRadius: 8 }}
            loading={saveLoading}
            disabled={!dirty || saveLoading || justSaved}
            onClick={saveWorkflow}
          >
            {justSaved ? 'Saved' : 'Save Workflow'}
          </Button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 40, color: '#888', fontSize: 16, fontWeight: 500, maxWidth: 600 }}>
          Data Visualisation coming soon.
        </div>
      </div>
    </AppLayout>
  );
};

export default DataVisualisation; 