import React from "react";
import { DatabaseOutlined, BarChartOutlined, AreaChartOutlined } from "@ant-design/icons";
import { clearLoggedIn } from '../auth';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { getCurrentUsername } from '../auth';
import { Button, Modal, Input, Tabs, List, Typography, message, Tooltip, Card, Spin } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, FileTextOutlined, UploadOutlined, DownloadOutlined, PlayCircleOutlined, SaveOutlined, ExperimentOutlined } from '@ant-design/icons';
import './DataAnalysis.css';
import AppLayout from '../components/Layout';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

const { Title } = Typography;

interface Script {
  id: string;
  name: string;
  description?: string;
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

// Utility to extract table/query names from script (simple regex for SQL identifiers)
function extractReferencedTables(script: string, savedQueries: any[]): string[] {
  const names = savedQueries.map(q => q.name);
  // Match words that are valid identifiers and in savedQueries
  const regex = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  const found = new Set<string>();
  let match;
  while ((match = regex.exec(script)) !== null) {
    if (names.includes(match[1])) {
      found.add(match[1]);
    }
  }
  return Array.from(found);
}

const DataAnalysis: React.FC<DataAnalysisProps> = ({ workflowId }) => {
  const currentStage = 1;
  const navigate = useNavigate();
  const [scripts, setScripts] = useState<Script[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingScript, setEditingScript] = useState<Script | null>(null);
  const [scriptName, setScriptName] = useState('');
  const [scriptDescription, setScriptDescription] = useState('');
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
  const [testLoading, setTestLoading] = useState(false);

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
    setScriptDescription('');
    setScriptType('sql');
    setScriptCode('');
    setModalOpen(true);
  };
  const openEditModal = (script: Script) => {
    setEditingScript(script);
    setScriptName(script.name);
    setScriptDescription(script.description || '');
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
      const updated = scripts.map(s => s.id === editingScript.id ? { ...s, name: scriptName, description: scriptDescription, type: scriptType, code: scriptCode } : s);
      saveScripts(updated);
    } else {
      // Create new
      const newScript: Script = {
        id: `script_${Date.now()}`,
        name: scriptName,
        description: scriptDescription,
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

  const handleRunScript = async (scriptObj: Script) => {
    if (!workflowId) return;
    setRunLoading(true);
    setRunModalOpen(true);
    setRunResult(null);
    try {
      // 1. Build base tables from dataframes
      const tables: Record<string, any[]> = {};
      dataframes.forEach((df: any) => {
        if (df.tableName && Array.isArray(df.data)) {
          tables[df.tableName] = df.data;
        }
      });
      // 2. Find referenced saved queries
      const referenced = extractReferencedTables(scriptObj.code, queries);
      // 3. For each referenced saved query, execute it and add its result to tables
      for (const qName of referenced) {
        const q = queries.find(q => q.name === qName);
        if (q) {
          // Call backend to execute the saved query
          const res = await fetch('http://localhost:8000/api/execute-query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query: q.query,
              language: q.type,
              tables,
            }),
          });
          const execData = await res.json();
          if (execData && Array.isArray(execData.data)) {
            tables[qName] = execData.data;
          } else if (execData && execData.result) {
            // For python, result is a dict of tables
            if (typeof execData.result === 'object') {
              // If the query name is in result, use it; else, use the first table
              if (Array.isArray(execData.result[qName])) {
                tables[qName] = execData.result[qName];
              } else {
                const firstTable = Object.values(execData.result).find(v => Array.isArray(v));
                tables[qName] = firstTable || [];
              }
            }
          } else {
            tables[qName] = [];
          }
        }
      }
      // 4. Run the analysis script with all tables
      const res = await fetch('http://localhost:8000/run_analysis_script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workflow_id: Number(workflowId),
          script: scriptObj.code,
          script_type: scriptObj.type,
          tables,
        }),
      });
      const resultData = await res.json();
      setRunResult(resultData);
    } catch (err) {
      setRunResult({ error: 'Failed to run script' });
    } finally {
      setRunLoading(false);
    }
  };

  // Test all scripts handler
  const handleTestScripts = async () => {
    if (!scripts || scripts.length === 0) {
      message.info('No scripts to test.');
      return;
    }
    setTestLoading(true);
    const failed: string[] = [];
    console.log('Testing scripts:', scripts.map(s => s.name));
    for (const scriptObj of scripts) {
      try {
        // 1. Build base tables from dataframes
        const tables: Record<string, any[]> = {};
        dataframes.forEach((df: any) => {
          if (df.tableName && Array.isArray(df.data)) {
            tables[df.tableName] = df.data;
          }
        });
        // 2. Find referenced saved queries
        const referenced = extractReferencedTables(scriptObj.code, queries);
        // 3. For each referenced saved query, execute it and add its result to tables
        for (const qName of referenced) {
          const q = queries.find(q => q.name === qName);
          if (q) {
            const res = await fetch('http://localhost:8000/api/execute-query', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                query: q.query,
                language: q.type,
                tables,
              }),
            });
            const execData = await res.json();
            if (execData && Array.isArray(execData.data)) {
              tables[qName] = execData.data;
            } else if (execData && execData.result) {
              if (typeof execData.result === 'object') {
                if (Array.isArray(execData.result[qName])) {
                  tables[qName] = execData.result[qName];
                } else {
                  const firstTable = Object.values(execData.result).find(v => Array.isArray(v));
                  tables[qName] = firstTable || [];
                }
              }
            } else {
              tables[qName] = [];
            }
          }
        }
        // 4. Run the analysis script with all tables
        const res = await fetch('http://localhost:8000/run_analysis_script', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workflow_id: Number(workflowId),
            script: scriptObj.code,
            script_type: scriptObj.type,
            tables,
          }),
        });
        const resultData = await res.json();
        if (resultData.error) {
          failed.push(scriptObj.name);
        }
      } catch (err) {
        failed.push(scriptObj.name);
      }
    }
    setTestLoading(false);
    console.log('Failed scripts:', failed);
    if (failed.length === 0) {
      message.success('All scripts executed successfully!');
    } else {
      message.error(`Failed scripts: ${failed.join(', ')}`);
    }
  };

  const handleImportScript = (scriptId: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      let type: 'sql' | 'python' = 'sql';
      if (file.name.endsWith('.py')) type = 'python';
      if (file.name.endsWith('.sql')) type = 'sql';
      setScripts(prev => prev.map(s =>
        s.id === scriptId ? { ...s, code: text, type } : s
      ));
      message.success('Script imported successfully!');
    };
    reader.readAsText(file);
  };

  const handleExportScript = (script: Script) => {
    const blob = new Blob([script.code], { type: 'text/plain' });
    const ext = script.type === 'python' ? 'py' : 'sql';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${script.name || 'script'}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    message.success('Script exported successfully!');
  };
  return (
    <AppLayout>
      <div className="data-preparation-container">
        {/* Header */}
        <div className="header-section">
          <div className="header-content">
            <div className="header-title">
              <BarChartOutlined className="header-icon" />
              <h1>Data Analysis</h1>
              <span className="stage-indicator">Stage 2 of 3</span>
            </div>
            <div className="header-actions">
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                loading={saveLoading}
                disabled={!dirty || saveLoading || justSaved}
                onClick={saveWorkflow}
                className="save-button"
              >
                {justSaved ? 'Saved' : 'Save Workflow'}
              </Button>
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="main-content">
          {/* Left Sidebar */}
          <div className="sidebar left-sidebar">
            <div className="sidebar-panels-container">
              <div className="panel-section">
                <div className="panel-header">
                  <h3>Data Sources</h3>
                </div>
                <List className="datasources-list-analysis"
                  size="small"
                  dataSource={dataframes}
                  locale={{ emptyText: 'No dataframes' }}
                  renderItem={item => (
                    <List.Item style={{ color: '#fff'}}>{item.tableName}</List.Item>
                  )}
                />
              </div>
              <div className="panel-section">
                <div className="panel-header">
                  <h3>Saved Queries</h3>
                </div>
                <List className="query-list-analysis"
                  size="small"
                  dataSource={queries}
                  locale={{ emptyText: 'No queries' }}
                  renderItem={item => (
                    <List.Item style={{ color: '#fff'}}>{item.name}</List.Item>
                  )}
                />
              </div>
            </div>
          </div>
          {/* Center Content */}
          <div className="center-content">
            <div className="query-editor-section">
              <div className="script-toolbar">
                <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal} className="run-button create-script-btn">
                  Create Script
                </Button>
                <Button
                  type="default"
                  icon={<ExperimentOutlined />} 
                  className="test-scripts-btn"
                  loading={testLoading}
                  disabled={testLoading || scripts.length === 0}
                  onClick={handleTestScripts}
                >
                  Test All Scripts
                </Button>
              </div>
              <div className="script-list-wrapper">
                <List
                  grid={{ gutter: 16, column: 1 }}
                  dataSource={scripts}
                  locale={{ emptyText: 'No scripts yet. Create your first script!' }}
                  renderItem={item => (
                    <List.Item className="script-list-item">
                      <div className="script-card">
                        <div className="script-card-content">
                          <div className="script-card-main">
                            <span><span className="script-label">Script Name:</span> <span className="script-title">{item.name}</span></span>
                            <span><span className="script-label">Script Type:</span> <span className="script-type">{item.type.toUpperCase()}</span></span>
                            <span><span className="script-label">Description:</span> <span className="script-description">{item.description || ''}</span></span>
                          </div>
                          <div className="script-card-actions">
                            <Tooltip title="Run"><Button type="text" size="small" icon={<PlayCircleOutlined />} className="run-script-btn" onClick={() => handleRunScript(item)} /></Tooltip>
                            <Tooltip title="Edit"><Button type="text" size="small" icon={<EditOutlined />} className="edit-script-btn" onClick={() => openEditModal(item)} /></Tooltip>
                            <Tooltip title="Delete"><Button type="text" size="small" icon={<DeleteOutlined />} className="delete-script-btn" onClick={() => handleDelete(item.id)} /></Tooltip>
                            <Tooltip title="Import Script">
                              <label className="import-script-btn">
                                <UploadOutlined />
                                <input type="file" accept=".sql,.py,.txt" style={{ display: 'none' }} onChange={handleImportScript(item.id)} />
                              </label>
                            </Tooltip>
                            <Tooltip title="Export Script">
                              <Button type="text" size="small" icon={<DownloadOutlined />} className="export-script-btn" onClick={() => handleExportScript(item)} />
                            </Tooltip>
                          </div>
                        </div>
                      </div>
                    </List.Item>
                  )}
                />
              </div>
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
          className="save-query-modal"
          style={{ top: 80 }}
        >
          <Input
            placeholder="Script Name"
            value={scriptName}
            onChange={e => setScriptName(e.target.value)}
            className="script-modal-input script-modal-title"
          />
          <Input
            placeholder="Description (optional)"
            value={scriptDescription}
            onChange={e => setScriptDescription(e.target.value)}
            className="script-modal-input script-modal-description"
          />
          <Tabs activeKey={scriptType} onChange={key => setScriptType(key as 'sql' | 'python')} className="script-modal-tabs">
            <Tabs.TabPane tab="SQL" key="sql" />
            <Tabs.TabPane tab="Python" key="python" />
          </Tabs>
          <div className="script-modal-editor">
            <CodeMirror
              value={scriptCode}
              height="180px"
              theme={oneDark}
              extensions={scriptType === 'sql' ? [sql()] : [python()]}
              onChange={(val: string) => setScriptCode(val)}
            />
          </div>
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