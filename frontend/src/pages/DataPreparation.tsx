import React, { useState, useEffect, useCallback } from "react";
import { Button, Select, Input, Tabs, Typography, Table, message, Tooltip, Modal, Upload, Collapse, Statistic, Tag } from "antd";
import { PlusOutlined, ArrowLeftOutlined, FileExcelOutlined, DatabaseOutlined, CloudServerOutlined, DownloadOutlined, BarChartOutlined, AreaChartOutlined, InboxOutlined, InfoCircleOutlined, EditOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import axios from "axios";
import './DataPreparation.css';
// CodeMirror imports
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { clearLoggedIn } from '../auth';
import AppLayout from '../components/Layout';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;
const { Dragger } = Upload;
const { Panel } = Collapse;

const dataSources = [
  { key: "oracle", label: "Oracle", icon: <DatabaseOutlined /> },
  { key: "sap", label: "SAP", icon: <CloudServerOutlined /> },
  { key: "excel", label: "Excel", icon: <FileExcelOutlined /> },
];

function exportToCSV(data: any[], columns: any[], filename: string) {
  if (!data.length) return;
  const header = columns.map((col: any) => col.title).join(",");
  const rows = data.map(row => columns.map((col: any) => JSON.stringify(row[col.dataIndex] ?? "")).join(",")).join("\n");
  const csv = header + "\n" + rows;
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const STAGES = [
  { key: 'prep', label: 'Data Preparation', icon: <DatabaseOutlined /> },
  { key: 'analysis', label: 'Data Analysis', icon: <BarChartOutlined /> },
  { key: 'viz', label: 'Data Visualisation', icon: <AreaChartOutlined /> },
];

interface DataPreparationProps {
  currentStage?: number;
  onStageClick?: (idx: number) => void;
  workflowId?: string;
}

const DataPreparation: React.FC<DataPreparationProps> = ({ currentStage = 0, onStageClick, workflowId }) => {
  const navigate = useNavigate();
  const [queryType, setQueryType] = useState<"sql" | "python">("sql");
  const [query, setQuery] = useState<string>("");
  const [showResults, setShowResults] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showSourceModal, setShowSourceModal] = useState(false);
  const [selectedSource, setSelectedSource] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]); // {tableName, sheetName, columns, data}
  const [tableCounter, setTableCounter] = useState(1);
  const [resultColumns, setResultColumns] = useState<any[]>([]);
  const [resultData, setResultData] = useState<any[]>([]);
  const [excelUploadPending, setExcelUploadPending] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [tableStats, setTableStats] = useState<Record<string, any>>({});
  const [tablePage, setTablePage] = useState(1);
  const [tablePageSize, setTablePageSize] = useState(10);
  const [editingTableName, setEditingTableName] = useState<string | null>(null);
  const [newTableName, setNewTableName] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedColumn, setSelectedColumn] = useState<any>(null);
  const [columnFilters, setColumnFilters] = useState<Record<string, any>>({});
  const [queryEditorHeight, setQueryEditorHeight] = useState(200);
  const [isDragging, setIsDragging] = useState(false);
  const [savedQueries, setSavedQueries] = useState<Array<{id: string, name: string, query: string, type: "sql" | "python"}>>([]);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [queryName, setQueryName] = useState<string>("");
  const [showSaveQueryModal, setShowSaveQueryModal] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Calculate column statistics and data types
  const calculateColumnStats = useCallback((data: any[], columns: any[]) => {
    const stats: Record<string, any> = {};
    
    columns.forEach(col => {
      const values = data.map(row => row[col.dataIndex]).filter(val => val !== null && val !== undefined);
      const nonNullValues = values.filter(val => val !== null && val !== undefined && val !== '');
      
      // Detect data type
      let dataType = 'string';
      if (nonNullValues.length > 0) {
        const sampleValues = nonNullValues.slice(0, 10);
        const isNumeric = sampleValues.every(val => !isNaN(Number(val)) && val !== '');
        const isDate = sampleValues.every(val => !isNaN(Date.parse(val)) && val !== '');
        
        if (isDate) dataType = 'date';
        else if (isNumeric) dataType = 'number';
        else dataType = 'string';
      }
      
      // Calculate statistics
      const uniqueValues = new Set(nonNullValues).size;
      const nullCount = values.length - nonNullValues.length;
      
      let min = null, max = null, mean = null, median = null, mode = null;
      let minDate = null, maxDate = null;
      
      if (dataType === 'number' && nonNullValues.length > 0) {
        const numericValues = nonNullValues.map(v => Number(v));
        min = Math.min(...numericValues);
        max = Math.max(...numericValues);
        mean = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;
        
        // Calculate median
        const sortedValues = numericValues.sort((a, b) => a - b);
        const mid = Math.floor(sortedValues.length / 2);
        median = sortedValues.length % 2 === 0 
          ? (sortedValues[mid - 1] + sortedValues[mid]) / 2 
          : sortedValues[mid];
        
        // Calculate mode
        const valueCounts: Record<number, number> = {};
        numericValues.forEach(val => {
          valueCounts[val] = (valueCounts[val] || 0) + 1;
        });
        const maxCount = Math.max(...Object.values(valueCounts));
        const modes = Object.keys(valueCounts).filter(key => valueCounts[Number(key)] === maxCount);
        mode = modes.length === 1 ? Number(modes[0]) : null; // Only show mode if there's exactly one
      }
      
      if (dataType === 'date' && nonNullValues.length > 0) {
        const dateValues = nonNullValues.map(v => new Date(v));
        minDate = new Date(Math.min(...dateValues.map(d => d.getTime())));
        maxDate = new Date(Math.max(...dateValues.map(d => d.getTime())));
      }
      
      stats[col.dataIndex] = {
        dataType,
        totalCount: values.length,
        nullCount,
        uniqueCount: uniqueValues,
        min,
        max,
        mean: mean ? Number(mean.toFixed(2)) : null,
        median: median ? Number(median.toFixed(2)) : null,
        mode: mode ? Number(mode.toFixed(2)) : null,
        minDate,
        maxDate
      };
    });
    
    return stats;
  }, []);

  // Filtered data for table search
  const filteredData = searchText
    ? resultData.filter(row =>
        Object.values(row).some(val =>
          String(val).toLowerCase().includes(searchText.toLowerCase())
        )
      )
    : resultData;

  // Reset page when search changes
  useEffect(() => {
    setTablePage(1);
  }, [searchText]);

  // Load sources and tableCounter from localStorage on mount
  useEffect(() => {
    const savedSources = localStorage.getItem('nz_sources');
    const savedCounter = localStorage.getItem('nz_tableCounter');
    if (savedSources) {
      setSources(JSON.parse(savedSources));
    }
    if (savedCounter) {
      setTableCounter(Number(savedCounter));
    }
  }, []);

  // Save sources and tableCounter to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('nz_sources', JSON.stringify(sources));
    localStorage.setItem('nz_tableCounter', String(tableCounter));
  }, [sources, tableCounter]);

  // Load workflow data_prep on mount
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
            setQuery(typeof parsed.query === 'string' ? parsed.query : "");
            setSavedQueries(Array.isArray(parsed.savedQueries) ? parsed.savedQueries : []);
            setSources(Array.isArray(parsed.sources) ? parsed.sources : []);
            setTableCounter(typeof parsed.tableCounter === 'number' ? parsed.tableCounter : 1);
            setResultColumns(Array.isArray(parsed.resultColumns) ? parsed.resultColumns : []);
            setResultData(Array.isArray(parsed.resultData) ? parsed.resultData : []);
            setTableStats(parsed.tableStats && typeof parsed.tableStats === 'object' ? parsed.tableStats : {});
          } catch {
            setQuery(data.data_prep); // fallback for legacy
            setSavedQueries([]);
            setSources([]);
            setTableCounter(1);
            setResultColumns([]);
            setResultData([]);
            setTableStats({});
          }
        }
      } catch (err) {
        // Optionally handle error
      }
    };
    fetchWorkflow();
  }, [workflowId]);

  // Mark dirty on user changes
  useEffect(() => { setDirty(true); }, [query, sources, savedQueries, tableCounter, resultColumns, resultData, tableStats]);

  // Save workflow data_prep (all state)
  const saveWorkflow = async () => {
    if (!workflowId) return;
    setSaveLoading(true);
    try {
      const dataToSave = JSON.stringify({
        query,
        savedQueries,
        sources,
        tableCounter,
        resultColumns,
        resultData,
        tableStats
      });
      await fetch(`http://localhost:8000/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data_prep: dataToSave }),
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

  // Navigation handlers
  const goToAnalysis = () => {
    navigate(`/workflow/${workflowId}/data-analysis`);
  };
  const goToVisualisation = () => {
    navigate(`/workflow/${workflowId}/data-visualisation`);
  };

  const handleRun = async () => {
    if (!query.trim()) {
      message.warning("Please enter a query to run.");
      return;
    }
    if (!sources.length) {
      message.warning("Please upload at least one Excel file first.");
      return;
    }
    setLoading(true);
    // Prepare tables object: {df1: [...], df2: [...], ...}
    const tables: Record<string, any[]> = {};
    sources.forEach(src => {
      tables[src.tableName] = src.data;
    });
    try {
      const res = await axios.post("http://localhost:8000/api/execute-query", {
        query,
        language: queryType,
        tables,
      });
      if (res.data.error) {
        message.error(res.data.error);
        setResultColumns([]);
        setResultData([]);
      } else {
        setResultColumns(res.data.columns);
        setResultData(res.data.data);
        // Calculate statistics for query results
        const resultStats = calculateColumnStats(res.data.data, res.data.columns);
        setTableStats(prev => ({ ...prev, 'query_results': resultStats }));
        setShowResults(true);
      }
    } catch (err) {
      message.error("Failed to execute query.");
      setResultColumns([]);
      setResultData([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddSource = () => {
    setShowSourceModal(true);
  };

  const handleSelectSource = (key: string) => {
    setSelectedSource(key);
    if (key === "excel") {
      setExcelUploadPending(true);
    } else {
      setShowSourceModal(false);
    }
  };

  // New: Load Excel data from backend if sources have a filePath
  const loadExcelFromBackend = useCallback(async (filePath: string, tableName: string) => {
    try {
      const filename = filePath.split('/').pop();
      const res = await fetch(`http://localhost:8000/download_excel/${filename}`);
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (data.length > 0) {
        const columns = (data[0] as string[]).map((col, idx) => ({
          title: col,
          dataIndex: String(col),
          key: String(col),
        }));
        const tableData = data.slice(1).map((row: any[], idx: number) => {
          const obj: any = { key: idx };
          columns.forEach((col: any, i: number) => {
            obj[col.dataIndex] = row[i];
          });
          return obj;
        });
        setSources(prev => prev.map(src => src.tableName === tableName ? { ...src, columns, data: tableData } : src));
      }
    } catch (err) {
      message.error('Failed to load Excel file from backend.');
    }
  }, []);

  // On workflow load, if sources have filePath, load data from backend
  useEffect(() => {
    sources.forEach(src => {
      if (src.filePath && (!src.data || src.data.length === 0)) {
        loadExcelFromBackend(src.filePath, src.tableName);
      }
    });
    // eslint-disable-next-line
  }, [sources.length]);

  // Update processExcelFile to upload file to backend and store only filePath
  const processExcelFile = useCallback(async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    try {
      const uploadRes = await fetch('http://localhost:8000/upload_excel', {
        method: 'POST',
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.path) throw new Error('Upload failed');
      const filePath = uploadData.path;
      // Now load the file from backend to get columns/data
      const filename = filePath.split('/').pop();
      const res = await fetch(`http://localhost:8000/download_excel/${filename}`);
      const blob = await res.blob();
      const arrayBuffer = await blob.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: 'array' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      if (data.length > 0) {
        const columns = (data[0] as string[]).map((col, idx) => ({
          title: col,
          dataIndex: String(col),
          key: String(col),
        }));
        const tableData = data.slice(1).map((row: any[], idx: number) => {
          const obj: any = { key: idx };
          columns.forEach((col: any, i: number) => {
            obj[col.dataIndex] = row[i];
          });
          return obj;
        });
        const tableName = `df${tableCounter}`;
        setSources(prev => [...prev, { tableName, sheetName: wsname, columns, data: tableData, filePath }]);
        setTableCounter(prev => prev + 1);
        setShowResults(true);
        setExcelUploadPending(false);
        setShowSourceModal(false);
        message.success(`Excel file loaded as ${tableName}!`);
      } else {
        message.warning('No data found in Excel file.');
      }
    } catch (err) {
      message.error('Failed to upload or process Excel file.');
      setExcelUploadPending(false);
      setShowSourceModal(false);
    }
  }, [tableCounter]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processExcelFile(file);
  };

  const handleDragUpload = useCallback((info: any) => {
    const { file } = info;
    if (file.status === 'done') {
      processExcelFile(file.originFileObj);
    }
  }, [processExcelFile]);

  const handleRenameTable = (tableName: string, newName: string) => {
    setSources(prev => prev.map(src => {
      if (src.tableName === tableName) {
        return { ...src, tableName: newName };
      }
      return src;
    }));
    setEditingTableName(null);
    setNewTableName(null);
  };

  const handleEditTableName = (tableName: string) => {
    setEditingTableName(tableName);
    setNewTableName(tableName);
  };

  const handleCancelEdit = () => {
    setEditingTableName(null);
    setNewTableName(null);
  };

  const handleSaveEdit = () => {
    if (newTableName && newTableName.trim() !== '') {
      handleRenameTable(editingTableName!, newTableName!);
    } else {
      message.warning("Table name cannot be empty.");
    }
  };

  const handleDeleteTable = (tableName: string) => {
    console.log('Delete button clicked for table:', tableName); // Debug log
    setTableToDelete(tableName);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (tableToDelete) {
      console.log('Deleting table:', tableToDelete); // Debug log
      setSources(prev => prev.filter(s => s.tableName !== tableToDelete));
      setTableStats(prev => {
        const newStats = { ...prev };
        delete newStats[tableToDelete];
        return newStats;
      });
      message.success(`Table "${tableToDelete}" deleted.`);
      setShowDeleteModal(false);
      setTableToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTableToDelete(null);
  };

  const handleColumnFilter = (column: any, tableName: string) => {
    setSelectedColumn({ ...column, tableName });
    setShowFilterModal(true);
  };

  const applyColumnFilter = (filterValue: any) => {
    if (selectedColumn) {
      const filterKey = `${selectedColumn.tableName}_${selectedColumn.dataIndex}`;
      setColumnFilters(prev => ({
        ...prev,
        [filterKey]: filterValue
      }));
      setShowFilterModal(false);
      setSelectedColumn(null);
      message.success(`Filter applied to ${selectedColumn.title}`);
    }
  };

  const clearColumnFilter = (column: any, tableName: string) => {
    const filterKey = `${tableName}_${column.dataIndex}`;
    setColumnFilters(prev => {
      const newFilters = { ...prev };
      delete newFilters[filterKey];
      return newFilters;
    });
    message.success(`Filter cleared for ${column.title}`);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const container = document.querySelector('.nz-center-pane-fixed');
      if (container) {
        const rect = container.getBoundingClientRect();
        const newHeight = e.clientY - rect.top;
        setQueryEditorHeight(Math.max(100, Math.min(rect.height - 100, newHeight)));
      }
    }
  }, [isDragging]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Query management functions
  const handleAddQuery = () => {
    const newQueryId = `query_${Date.now()}`;
    setCurrentQueryId(newQueryId);
    setQuery("");
    setQueryType("sql");
    setQueryName("");
    setShowResults(false);
    setResultData([]);
    setResultColumns([]);
  };

  const handleSaveQuery = () => {
    if (!query.trim()) {
      message.warning("Please enter a query before saving.");
      return;
    }
    setShowSaveQueryModal(true);
  };

  const confirmSaveQuery = () => {
    if (!queryName.trim()) {
      message.warning("Please enter a query name.");
      return;
    }

    const queryToSave = {
      id: currentQueryId || `query_${Date.now()}`,
      name: queryName,
      query: query,
      type: queryType
    };

    if (currentQueryId && savedQueries.find(q => q.id === currentQueryId)) {
      // Update existing query
      setSavedQueries(prev => prev.map(q => 
        q.id === currentQueryId ? queryToSave : q
      ));
      message.success("Query updated successfully!");
    } else {
      // Add new query
      setSavedQueries(prev => [...prev, queryToSave]);
      setCurrentQueryId(queryToSave.id);
      message.success("Query saved successfully!");
    }

    setShowSaveQueryModal(false);
    setQueryName("");
    
    // Clear query editor after saving
    setQuery("");
    setCurrentQueryId(null);
    setShowResults(false);
    setResultData([]);
    setResultColumns([]);
  };

  const handleLoadQuery = (queryObj: {id: string, name: string, query: string, type: "sql" | "python"}) => {
    setCurrentQueryId(queryObj.id);
    setQuery(queryObj.query);
    setQueryType(queryObj.type);
    setQueryName(queryObj.name);
    setShowResults(false);
    setResultData([]);
    setResultColumns([]);
  };

  const handleDeleteQuery = (queryId: string) => {
    setSavedQueries(prev => prev.filter(q => q.id !== queryId));
    if (currentQueryId === queryId) {
      setCurrentQueryId(null);
      setQuery("");
      setQueryName("");
    }
    message.success("Query deleted successfully!");
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };

  return (
    <AppLayout>
      <div style={{
        width: '100%',
        maxWidth: 1300,
        margin: '0 auto',
        padding: '32px 0',
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 64px)', // header height
        minHeight: 0,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexShrink: 0 }}>
          <Button type="primary" style={{ fontWeight: 700, borderRadius: 8 }}
            loading={saveLoading}
            disabled={!dirty || saveLoading || justSaved}
            onClick={saveWorkflow}
          >
            {justSaved ? 'Saved' : 'Save Workflow'}
          </Button>
        </div>
        {/* Main content: two columns, fit to viewport */}
        <div style={{
          width: '100%',
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          gap: 32,
          minHeight: 0,
          overflow: 'hidden',
        }}>
          {/* Left: Data Sources & Saved Queries (fixed width, scrollable if needed) */}
          <div style={{
            width: 320,
            minWidth: 260,
            maxWidth: 360,
            background: 'rgba(36, 39, 60, 0.92)',
            borderRadius: 10,
            padding: 24,
            boxShadow: '0 4px 24px #6366f122',
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            overflowY: 'auto',
            maxHeight: '100%',
          }}>
            {/* Data Sources */}
            <div>
              <div style={{ color: '#6366f1', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Data Sources</div>
              <Button shape="circle" icon={<PlusOutlined />} size="large" style={{ background: '#18181b', color: '#7072c0', border: 'none', boxShadow: '0 2px 8px #6366f122', marginBottom: 16 }} onClick={handleAddSource} />
              {sources.length > 0 && (
                <Collapse ghost size="small" style={{ background: 'transparent' }}>
                  {sources.map(src => (
                    <Panel 
                      header={<span style={{ fontSize: 13, color: '#bfbfbf' }}><b>{src.tableName}</b> <span style={{ color: '#888' }}>({src.sheetName})</span></span>}
                      key={src.tableName}
                      style={{ background: '#23272b', borderRadius: 6, marginBottom: 8, border: '1px solid #23272b' }}
                    >
                      <div style={{ padding: '8px 0', maxHeight: 180, overflowY: 'auto' }}>
                        {src.columns.map((col: any) => (
                          <div key={col.dataIndex} style={{ marginBottom: 8, color: '#bfbfbf', fontSize: 12 }}>{col.title}</div>
                        ))}
                      </div>
                    </Panel>
                  ))}
                </Collapse>
              )}
            </div>
            {/* Saved Queries */}
            {savedQueries.length > 0 && (
              <div>
                <div style={{ color: '#6366f1', fontSize: 16, fontWeight: 700, marginBottom: 8 }}>Saved Queries</div>
                <Collapse ghost size="small" style={{ background: 'transparent' }}>
                  {savedQueries.map(queryObj => (
                    <Panel 
                      header={<span style={{ fontSize: 13, color: '#bfbfbf' }}><b>{queryObj.name}</b> <span style={{ color: '#888', marginLeft: 8 }}>{queryObj.type.toUpperCase()}</span></span>}
                      key={queryObj.id}
                      style={{ background: '#23272b', borderRadius: 6, marginBottom: 8, border: '1px solid #23272b' }}
                    >
                      <div style={{ padding: '8px 0', color: '#888', fontSize: 11, fontFamily: 'monospace', backgroundColor: '#1a1a1a', borderRadius: 4 }}>{queryObj.query}</div>
                      <Button size="small" type="primary" onClick={() => handleLoadQuery(queryObj)} style={{ width: '100%', marginTop: 8 }}>Load Query</Button>
                    </Panel>
                  ))}
                </Collapse>
              </div>
            )}
          </div>
          {/* Right: Editor and Table Preview (vertical split, both scrollable, always fit) */}
          <div style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            height: '100%',
            overflow: 'hidden',
          }}>
            {/* Editor (top, scrollable if needed) */}
            <div style={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              background: 'rgba(24,24,27,0.98)',
              borderRadius: 16,
              boxShadow: '0 4px 24px #6366f122',
              padding: 24,
              border: '1.5px solid #23272b',
              position: 'relative',
              overflowY: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <Tabs
                  activeKey={queryType}
                  onChange={(key) => setQueryType(key as "sql" | "python")}
                  items={[
                    { key: "sql", label: "SQL" },
                    { key: "python", label: "Python" },
                  ]}
                  style={{ marginBottom: 0 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button type="primary" onClick={handleRun} loading={loading} style={{ background: 'linear-gradient(90deg, #6366f1 0%, #0ea5e9 100%)', borderRadius: 8, fontWeight: 700, border: 'none', color: '#fff' }}>Run</Button>
                  <Button onClick={handleSaveQuery} style={{ borderColor: '#52c41a', color: '#52c41a' }} disabled={!query.trim()}>Save Query</Button>
                </div>
              </div>
              <CodeMirror
                value={query}
                height={'100px'}
                theme={oneDark}
                extensions={[queryType === 'sql' ? sql() : python()]}
                onChange={val => setQuery(val)}
                basicSetup={{
                  lineNumbers: true,
                  highlightActiveLine: true,
                  foldGutter: true,
                  autocompletion: true,
                }}
                style={{ borderRadius: 8, fontSize: 14, marginTop: 8 }}
              />
            </div>
            {/* Table Preview (bottom, scrollable if needed) */}
            <div style={{
              flex: 1,
              minHeight: 0,
              width: '100%',
              background: 'rgba(24,24,27,0.98)',
              borderRadius: 16,
              boxShadow: '0 4px 24px #6366f122',
              padding: 24,
              border: '1.5px solid #23272b',
              overflowY: 'auto',
              marginBottom: 0,
            }}>
              <Title level={5} style={{ color: '#6366f1', margin: 0 }}>Results {filteredData.length > 0 && (<span style={{ color: '#bfbfbf', fontWeight: 400, fontSize: 13, marginLeft: 12 }}>({filteredData.length} rows)</span>)}</Title>
              {resultData.length > 0 && (
                <Button icon={<DownloadOutlined />} style={{ marginTop: 16, float: 'right', background: '#40a9ff', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }} onClick={() => exportToCSV(resultData, resultColumns, 'data-preparation-export.csv')}>Export</Button>
              )}
              {resultData.length > 0 && (
                <Input.Search placeholder="Search table..." allowClear value={searchText} onChange={e => setSearchText(e.target.value)} style={{ marginBottom: 16, maxWidth: 320 }} />
              )}
              {filteredData.length > 0 ? (
                <div style={{ maxHeight: 220, overflow: 'auto' }}>
                  <Table dataSource={filteredData} columns={resultColumns.map(col => ({ ...col, sorter: (a: any, b: any) => String(a[col.dataIndex]).localeCompare(String(b[col.dataIndex])) }))} pagination={false} size="small" bordered style={{ background: '#23272b', borderRadius: 8 }} />
                </div>
              ) : null}
            </div>
          </div>
        </div>
        {/* Modals */}
        <Modal open={showSourceModal} onCancel={() => { setShowSourceModal(false); setExcelUploadPending(false); }} footer={null} title={excelUploadPending ? "Upload Excel File" : "Select Data Source"} centered>
          {!excelUploadPending ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {dataSources.map(src => (
                <Button
                  key={src.key}
                  icon={src.icon}
                  disabled={src.key !== 'excel'}
                  onClick={() => handleSelectSource(src.key)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start', fontWeight: 600 }}
                >
                  {src.label}
                  {src.key !== 'excel' && <span style={{ marginLeft: 8, color: '#aaa', fontSize: 12 }}>(Coming soon)</span>}
                </Button>
              ))}
            </div>
          ) : (
            <div style={{ marginTop: 8 }}>
              <label style={{ color: '#6366f1', fontWeight: 600, marginBottom: 8, display: 'block' }}>Choose Excel File</label>
              <Dragger
                name="file"
                multiple={false}
                accept=".xlsx,.xls"
                customRequest={({ file, onSuccess }: any) => {
                  setTimeout(() => {
                    onSuccess("ok");
                  }, 0);
                }}
                onChange={handleDragUpload}
                showUploadList={false}
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined style={{ color: '#6366f1', fontSize: '48px' }} />
                </p>
                <p className="ant-upload-text" style={{ color: '#bfbfbf', margin: '8px 0' }}>
                  Click or drag Excel file to this area to upload
                </p>
                <p className="ant-upload-hint" style={{ color: '#888', fontSize: '12px' }}>
                  Support for .xlsx and .xls files
                </p>
              </Dragger>
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <span style={{ color: '#888', fontSize: '12px' }}>Or </span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls" 
                  onChange={handleExcelUpload} 
                  className="nz-file-input"
                />
                <span style={{ color: '#888', fontSize: '12px' }}> to browse files</span>
              </div>
            </div>
          )}
        </Modal>
        <Modal open={showDeleteModal} onOk={confirmDelete} onCancel={cancelDelete} title="Confirm Deletion" okText="Delete" cancelText="Cancel" centered>
          <p>Are you sure you want to delete "{tableToDelete}"? This action cannot be undone.</p>
        </Modal>
        <Modal open={showSaveQueryModal} onOk={confirmSaveQuery} onCancel={() => { setShowSaveQueryModal(false); setQueryName(""); }} title="Save Query" okText="Save" cancelText="Cancel" centered>
          <div style={{ padding: '16px 0' }}>
            <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Query Name:</label>
            <Input placeholder="Enter query name..." value={queryName} onChange={e => setQueryName(e.target.value)} onPressEnter={confirmSaveQuery} autoFocus />
            <div style={{ marginTop: 12, color: '#888', fontSize: 12 }}>
              <strong>Query Preview:</strong>
              <div style={{ marginTop: 4, padding: '8px', backgroundColor: '#1a1a1a', borderRadius: '4px', fontFamily: 'monospace', fontSize: '11px', maxHeight: '100px', overflow: 'auto' }}>{query}</div>
            </div>
          </div>
        </Modal>
        <Modal open={showFilterModal} onCancel={() => { setShowFilterModal(false); setSelectedColumn(null); }} title={`Filter Column: ${selectedColumn?.title}`} footer={null} centered>
          {selectedColumn && (
            <div style={{ padding: '16px 0' }}>
              {(() => {
                const stats = tableStats[selectedColumn.tableName]?.[selectedColumn.dataIndex];
                if (!stats) return null;
                
                if (stats.dataType === 'number') {
                  return (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Range Filter:</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Input
                            placeholder="Min value"
                            type="number"
                            style={{ flex: 1 }}
                            onChange={(e) => {
                              const min = e.target.value ? Number(e.target.value) : null;
                              const maxInput = document.getElementById('max-filter') as HTMLInputElement;
                              const max = maxInput?.value ? Number(maxInput.value) : null;
                              if (min !== null || max !== null) {
                                applyColumnFilter({ min, max, type: 'range' });
                              }
                            }}
                          />
                          <span style={{ color: '#888' }}>to</span>
                          <Input
                            id="max-filter"
                            placeholder="Max value"
                            type="number"
                            style={{ flex: 1 }}
                            onChange={(e) => {
                              const max = e.target.value ? Number(e.target.value) : null;
                              const minInput = document.getElementById('min-filter') as HTMLInputElement;
                              const min = minInput?.value ? Number(minInput.value) : null;
                              if (min !== null || max !== null) {
                                applyColumnFilter({ min, max, type: 'range' });
                              }
                            }}
                          />
                        </div>
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Quick Filters:</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'top', value: 10 })}>Top 10</Button>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'bottom', value: 10 })}>Bottom 10</Button>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'above_avg' })}>Above Average</Button>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'below_avg' })}>Below Average</Button>
                        </div>
                      </div>
                    </div>
                  );
                } else if (stats.dataType === 'date') {
                  return (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Date Range:</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <Input
                            type="date"
                            style={{ flex: 1 }}
                            onChange={(e) => {
                              const startDate = e.target.value;
                              const endDate = (document.getElementById('end-date-filter') as HTMLInputElement)?.value;
                              if (startDate || endDate) {
                                applyColumnFilter({ startDate, endDate, type: 'date_range' });
                              }
                            }}
                          />
                          <span style={{ color: '#888' }}>to</span>
                          <Input
                            id="end-date-filter"
                            type="date"
                            style={{ flex: 1 }}
                            onChange={(e) => {
                              const endDate = e.target.value;
                              const startDate = (document.getElementById('start-date-filter') as HTMLInputElement)?.value;
                              if (startDate || endDate) {
                                applyColumnFilter({ startDate, endDate, type: 'date_range' });
                              }
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Text Filter:</label>
                        <Input
                          placeholder="Enter text to filter..."
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value) {
                              applyColumnFilter({ value, type: 'text' });
                            }
                          }}
                        />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <label style={{ color: '#bfbfbf', display: 'block', marginBottom: 8 }}>Quick Filters:</label>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'not_null' })}>Not Empty</Button>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'is_null' })}>Empty</Button>
                          <Button size="small" onClick={() => applyColumnFilter({ type: 'unique' })}>Unique Values</Button>
                        </div>
                      </div>
                    </div>
                  );
                }
              })()}
            </div>
          )}
        </Modal>
      </div>
    </AppLayout>
  );
};

export default DataPreparation; 