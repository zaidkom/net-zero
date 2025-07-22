import React from "react";
import { DatabaseOutlined, BarChartOutlined, AreaChartOutlined } from "@ant-design/icons";
import { clearLoggedIn } from '../auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCurrentUsername } from '../auth';
import { Button, Modal, Input, Tabs, List, Typography, message, Tooltip, Card } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined } from '@ant-design/icons';
import './DataAnalysis.css';
import AppLayout from '../components/Layout';

const { Title } = Typography;

interface Script {
  id: string;
  name: string;
  type: 'sql' | 'python';
  code: string;
}

const STAGES = [
  { key: 'prep', label: 'Data Preparation', icon: <DatabaseOutlined /> },
  { key: 'analysis', label: 'Data Analysis', icon: <BarChartOutlined /> },
  { key: 'viz', label: 'Data Visualisation', icon: <AreaChartOutlined /> },
];

interface DataAnalysisProps {
  workflowId?: string;
}

const DataAnalysis: React.FC<DataAnalysisProps> = ({ workflowId }) => {
  const currentStage = 1;
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptType, setScriptType] = useState<'sql' | 'python'>('sql');
  const [scriptCode, setScriptCode] = useState('');
  const [dataframes, setDataframes] = useState<any[]>([]); // sources from data prep
  const [queries, setQueries] = useState<any[]>([]); // saved queries from data prep
  const [runResult, setRunResult] = useState<any>(null);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Load scripts from workflow.analysis on mount
  useEffect(() => {
    if (!workflowId) return;
    const fetchWorkflow = async () => {
      try {
        const res = await fetch(`http://localhost:8000/workflows/${workflowId}`);
        if (!res.ok) throw new Error('Failed to fetch workflow');
        const data = await res.json();
        if (data.analysis) {
          try {
            const parsed = JSON.parse(data.analysis);
            setScripts(Array.isArray(parsed) ? parsed : []);
          } catch {
            setScripts([]);
          }
        }
      } catch (err) {
        setScripts([]);
      }
    };
    fetchWorkflow();
  }, [workflowId]);

  // Load dataframes and queries from workflow.data_prep
  useEffect(() => {
    if (!workflowId) return;
    const fetchWorkflow = async () => {
      try {
        const res = await fetch(`http://localhost:8000/workflows/${workflowId}`);
        if (!res.ok) throw new Error('Failed to fetch workflow');
        const data = await res.json();
        if (data.data_prep) {
          try {
            const parsed = JSON.parse(data.data_prep);
            setDataframes(Array.isArray(parsed.sources) ? parsed.sources : []);
            setQueries(Array.isArray(parsed.savedQueries) ? parsed.savedQueries : []);
          } catch {
            setDataframes([]);
            setQueries([]);
          }
        }
      } catch (err) {
        setDataframes([]);
        setQueries([]);
      }
    };
    fetchWorkflow();
  }, [workflowId]);

  // Mark dirty on user changes
  useEffect(() => { setDirty(true); }, [scripts]);

  // Save scripts to backend
  const saveScripts = async (newScripts: Script[]) => {
    if (!workflowId) return;
    try {
      await fetch(`http://localhost:8000/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: JSON.stringify(newScripts) }),
      });
      setScripts(newScripts);
    } catch (err) {
      message.error('Failed to save scripts');
    }
  };

  const saveWorkflow = async () => {
    if (!workflowId) return;
    setSaveLoading(true);
    try {
      await fetch(`http://localhost:8000/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ analysis: JSON.stringify(scripts) }),
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

  // Modal handlers
  const openCreateModal = () => {
    setEditingScript(null);
    setScriptName('');
    setScriptType('sql');
    setScriptCode('');
    setModalOpen(true);
  };
  const openEditModal = (script: Script) => {
    setEditingScript(script);
    setScriptName(script.name);
    setScriptType(script.type);
    setScriptCode(script.code);
    setModalOpen(true);
  };
  const handleModalOk = () => {
    if (!scriptName.trim() || !scriptCode.trim()) {
      message.warning('Script name and code are required');
      return;
    }
    if (editingScript) {
      // Edit existing
      const updated = scripts.map(s => s.id === editingScript.id ? { ...s, name: scriptName, type: scriptType, code: scriptCode } : s);
      saveScripts(updated);
    } else {
      // Create new
      const newScript: Script = {
        id: `script_${Date.now()}`,
        name: scriptName,
        type: scriptType,
        code: scriptCode,
      };
      saveScripts([newScript, ...scripts]);
    }
    setModalOpen(false);
  };
  const handleModalCancel = () => {
    setModalOpen(false);
  };
  const handleDelete = (id: string) => {
    const updated = scripts.filter(s => s.id !== id);
    saveScripts(updated);
  };

  const goToPreparation = () => {
    navigate(`/workflow/${workflowId}/data-preparation`);
  };
  const goToVisualisation = () => {
    navigate(`/workflow/${workflowId}/data-visualisation`);
  };

  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };

  const handleRunScript = async (script: Script) => {
    if (!workflowId) return;
    setRunLoading(true);
    setRunModalOpen(true);
    setRunResult(null);
    try {
      const res = await fetch('http://localhost:8000/run_analysis_script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: Number(workflowId),
          script: script.code,
          script_type: script.type,
        }),
      });
      const data = await res.json();
      setRunResult(data);
    } catch (err) {
      setRunResult({ error: 'Failed to run script' });
    } finally {
      setRunLoading(false);
    }
  };
  return (
    <AppLayout>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 0', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={3} style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Data Analysis</Title>
          <Button type="primary" style={{ fontWeight: 700, borderRadius: 8 }}
            loading={saveLoading}
            disabled={!dirty || saveLoading || justSaved}
            onClick={saveWorkflow}
          >
            {justSaved ? 'Saved' : 'Save Workflow'}
          </Button>
        </div>
        <Button style={{ alignSelf: 'flex-end', marginBottom: 24 }} onClick={() => navigate(-1)}>Back</Button>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'row', gap: 32, justifyContent: 'center' }}>
          {/* Sidebar: DataFrames and Queries */}
          <div style={{ minWidth: 220, maxWidth: 280, background: 'rgba(36, 39, 60, 0.92)', borderRadius: 18, padding: 24, boxShadow: '0 4px 24px #6366f122', display: 'flex', flexDirection: 'column', gap: 24 }}>
            <div style={{ color: '#7f8cff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Available DataFrames</div>
            <List
              size="small"
              dataSource={dataframes}
              locale={{ emptyText: 'No dataframes' }}
              renderItem={item => (
                <List.Item style={{ color: '#fff', fontWeight: 600 }}>{item.tableName}</List.Item>
              )}
              style={{ marginBottom: 24 }}
            />
            <div style={{ color: '#7f8cff', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Saved Queries</div>
            <List
              size="small"
              dataSource={queries}
              locale={{ emptyText: 'No queries' }}
              renderItem={item => (
                <List.Item style={{ color: '#fff', fontWeight: 600 }}>{item.name}</List.Item>
              )}
            />
          </div>
          {/* Main Pane: Scripts */}
          <div style={{ flex: 1, minWidth: 320, maxWidth: 600, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} style={{ background: 'linear-gradient(90deg, #7f8cff 0%, #e14eca 100%)', color: '#fff', fontWeight: 700, fontSize: 16, border: 'none', borderRadius: 12, height: 44, width: 200, marginBottom: 24, boxShadow: '0 2px 12px #7f8cff33' }}>
              Create Script
            </Button>
            <div style={{ width: '100%' }}>
              <List
                grid={{ gutter: 24, column: 1 }}
                dataSource={scripts}
                locale={{ emptyText: 'No scripts yet. Create your first script!' }}
                renderItem={item => (
                  <List.Item>
                    <Card
                      style={{ background: 'rgba(36, 39, 60, 0.92)', borderRadius: 18, boxShadow: '0 4px 24px #7f8cff33', padding: '24px 32px', minWidth: 280, maxWidth: 600, width: '100%', color: '#fff', fontSize: 15, border: '1.5px solid #2a2d3e', marginBottom: 16 }}
                      actions={[
                        <Tooltip title="Run"><Button type="link" onClick={() => handleRunScript(item)}>Run</Button></Tooltip>,
                        <Tooltip title="Edit"><EditOutlined onClick={() => openEditModal(item)} /></Tooltip>,
                        <Tooltip title="Delete"><DeleteOutlined onClick={() => handleDelete(item.id)} /></Tooltip>
                      ]}
                      title={<span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: 0.5 }}><FileTextOutlined style={{ marginRight: 8 }} />{item.name}</span>}
                      extra={<span style={{ color: '#bfbfbf', fontWeight: 500 }}>{item.type.toUpperCase()}</span>}
                      bodyStyle={{ color: '#bfbfbf', fontSize: 14, minHeight: 32, maxHeight: 80, overflow: 'auto', fontFamily: 'monospace' }}
                    >
                      <div style={{ whiteSpace: 'pre-line' }}>{item.code.slice(0, 200)}{item.code.length > 200 ? '...' : ''}</div>
                    </Card>
                  </List.Item>
                )}
              />
            </div>
          </div>
        </div>
        {/* Modals */}
        <Modal
          open={modalOpen}
          onOk={handleModalOk}
          onCancel={handleModalCancel}
          title={editingScript ? 'Edit Script' : 'Create Script'}
          okText="Save"
          cancelText="Cancel"
          centered
          width={600}
          style={{ top: 80 }}
          bodyStyle={{ background: 'rgba(36, 39, 60, 0.98)', borderRadius: 18, color: '#fff' }}
        >
          <Input
            placeholder="Script Name"
            value={scriptName}
            onChange={e => setScriptName(e.target.value)}
            style={{ marginBottom: 16, fontSize: 16 }}
          />
          <Tabs activeKey={scriptType} onChange={key => setScriptType(key as 'sql' | 'python')} style={{ marginBottom: 8 }}>
            <Tabs.TabPane tab="SQL" key="sql" />
            <Tabs.TabPane tab="Python" key="python" />
          </Tabs>
          <Input.TextArea
            rows={10}
            value={scriptCode}
            onChange={e => setScriptCode(e.target.value)}
            placeholder={scriptType === 'sql' ? 'Write your SQL script here...' : 'Write your Python script here...'}
            style={{ fontFamily: 'monospace', fontSize: 15 }}
          />
        </Modal>
        <Modal
          open={runModalOpen}
          onCancel={() => setRunModalOpen(false)}
          title="Script Result"
          footer={null}
          width={700}
          style={{ top: 80 }}
          bodyStyle={{ background: '#18181b', color: '#fff', borderRadius: 18 }}
        >
          {runLoading ? <div style={{ textAlign: 'center', fontSize: 18 }}>Running...</div> : (
            runResult && runResult.error ? (
              <div style={{ color: 'red', fontWeight: 600 }}>{runResult.error}<pre style={{ color: '#888', fontSize: 12 }}>{runResult.trace}</pre></div>
            ) : (
              <pre style={{ maxHeight: 400, overflow: 'auto', background: '#18181b', color: '#fff', borderRadius: 8, padding: 16 }}>{JSON.stringify(runResult?.result, null, 2)}</pre>
            )
          )}
        </Modal>
      </div>
    </AppLayout>
  );
};

export default DataAnalysis; 