import React, { useState, useEffect, useCallback } from "react";
import { Button, Select, Input, Tabs, Typography, Table, message, Tooltip, Modal, Upload, Collapse, Statistic, Tag } from "antd";
import { PlusOutlined, ArrowLeftOutlined, FileExcelOutlined, DatabaseOutlined, CloudServerOutlined, DownloadOutlined, BarChartOutlined, AreaChartOutlined, InboxOutlined, InfoCircleOutlined, EditOutlined, CheckOutlined, CloseOutlined, DeleteOutlined, SaveOutlined, PlayCircleOutlined, ReloadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import axios from "axios";
import './DataPreparation.css';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { clearLoggedIn } from '../auth';
import AppLayout from '../components/Layout';
import DataSourcePanel from '../components/DataSourcePanel';
import QueryEditor from '../components/QueryEditor';
import ResultsTable from '../components/ResultsTable';
import SavedQueriesPanel from '../components/SavedQueriesPanel';

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
  const [sources, setSources] = useState<any[]>([]);
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
  const [savedQueries, setSavedQueries] = useState<Array<{id: string, name: string, query: string, type: "sql" | "python"}>>([]);
  const [currentQueryId, setCurrentQueryId] = useState<string | null>(null);
  const [queryName, setQueryName] = useState<string>("");
  const [showSaveQueryModal, setShowSaveQueryModal] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [showDataTypes, setShowDataTypes] = useState(false);

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
        mode = modes.length === 1 ? Number(modes[0]) : null;
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

  // Enhanced data type detection function
  const detectColumnDataType = useCallback((data: any[], columnName: string) => {
    const values = data.map(row => row[columnName]).filter(val => val !== null && val !== undefined && val !== '');
    
    if (values.length === 0) return 'string';
    
    const sampleValues = values.slice(0, 50); // Check first 50 values for better accuracy
    
    // Check if all values are valid numbers
    const isNumeric = sampleValues.every(val => {
      const num = Number(val);
      return !isNaN(num) && val !== '' && val !== null;
    });
    
    // Check if all values are valid dates
    const isDate = sampleValues.every(val => {
      const date = new Date(val);
      return !isNaN(date.getTime()) && val !== '' && val !== null;
    });
    
    // Check if all values are boolean
    const isBoolean = sampleValues.every(val => {
      const str = String(val).toLowerCase();
      return str === 'true' || str === 'false' || str === '1' || str === '0';
    });
    
    if (isBoolean) return 'boolean';
    if (isDate) return 'date';
    if (isNumeric) return 'number';
    return 'string';
  }, []);

  // Function to refresh data sources and detect data types
  const handleRefreshSources = useCallback(async () => {
    if (sources.length === 0) {
      message.info('No data sources to refresh.');
      return;
    }

    setLoading(true);
    try {
      const updatedSources = sources.map(source => {
        const updatedColumns = source.columns.map((col: any) => ({
          ...col,
          dataType: detectColumnDataType(source.data, col.dataIndex)
        }));
        
        return {
          ...source,
          columns: updatedColumns
        };
      });
      
      setSources(updatedSources);
      setShowDataTypes(true);
      message.success('Data sources refreshed successfully!');
    } catch (error) {
      message.error('Failed to refresh data sources.');
      console.error('Error refreshing sources:', error);
    } finally {
      setLoading(false);
    }
  }, [sources, detectColumnDataType]);

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
            setQuery(data.data_prep);
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
      message.success('Workflow saved successfully!');
      setTimeout(() => setJustSaved(false), 2000);
    } catch (err) {
      message.error('Failed to save workflow');
    } finally {
      setSaveLoading(false);
    }
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
        const resultStats = calculateColumnStats(res.data.data, res.data.columns);
        setTableStats(prev => ({ ...prev, 'query_results': resultStats }));
        setShowResults(true);
        message.success(`Query executed successfully! ${res.data.data.length} rows returned.`);
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

  useEffect(() => {
    sources.forEach(src => {
      if (src.filePath && (!src.data || src.data.length === 0)) {
        loadExcelFromBackend(src.filePath, src.tableName);
      }
    });
  }, [sources.length, loadExcelFromBackend]);

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
        message.success(`Excel file loaded as ${tableName}! ${tableData.length} rows imported.`);
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
    message.success(`Table renamed to "${newName}"`);
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
    setTableToDelete(tableName);
    setShowDeleteModal(true);
  };

  const confirmDelete = () => {
    if (tableToDelete) {
      setSources(prev => prev.filter(s => s.tableName !== tableToDelete));
      setTableStats(prev => {
        const newStats = { ...prev };
        delete newStats[tableToDelete];
        return newStats;
      });
      message.success(`Table "${tableToDelete}" deleted successfully.`);
      setShowDeleteModal(false);
      setTableToDelete(null);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setTableToDelete(null);
  };

  // Query management functions
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
      setSavedQueries(prev => prev.map(q => 
        q.id === currentQueryId ? queryToSave : q
      ));
      message.success("Query updated successfully!");
    } else {
      setSavedQueries(prev => [...prev, queryToSave]);
      setCurrentQueryId(queryToSave.id);
      message.success("Query saved successfully!");
    }

    setShowSaveQueryModal(false);
    setQueryName("");
    
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
    message.success(`Query "${queryObj.name}" loaded successfully!`);
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

  return (
    <AppLayout>
      <div className="data-preparation-container">
        {/* Header Section */}
        <div className="header-section">
          <div className="header-content">
            <div className="header-title">
              <div className="header-icon">
                <DatabaseOutlined />
              </div>
              <h1>Data Preparation</h1>
              <div className="stage-indicator">Stage 1 of 3</div>
            </div>
            <div className="header-actions">
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={saveWorkflow}
                disabled={!dirty}
                className="save-button"
              >
                Save Workflow
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="main-content">
          {/* Left Sidebar */}
          <div className="sidebar left-sidebar">
            <div className="sidebar-panels-container">
              <DataSourcePanel 
                sources={sources}
                onAddSource={handleAddSource}
                onRefreshSources={handleRefreshSources}
                onEditTableName={handleEditTableName}
                onDeleteTable={handleDeleteTable}
                editingTableName={editingTableName}
                newTableName={newTableName}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={handleCancelEdit}
                setNewTableName={setNewTableName}
                showDataTypes={showDataTypes}
              />
              {savedQueries.length > 0 && (
                <SavedQueriesPanel 
                  savedQueries={savedQueries}
                  onLoadQuery={handleLoadQuery}
                  onDeleteQuery={handleDeleteQuery}
                />
              )}
            </div>
          </div>

          {/* Center Content */}
          <div className="center-content">
            <div className="query-results-container">
              <QueryEditor 
                queryType={queryType}
                setQueryType={setQueryType}
                query={query}
                setQuery={setQuery}
                onRun={handleRun}
                onSave={handleSaveQuery}
                loading={loading}
              />
              <ResultsTable 
                resultData={filteredData}
                resultColumns={resultColumns}
                searchText={searchText}
                setSearchText={setSearchText}
                onExport={() => exportToCSV(resultData, resultColumns, 'data-preparation-export.csv')}
              />
            </div>
          </div>
        </div>

        {/* Modals */}
        <Modal 
          open={showSourceModal} 
          onCancel={() => { setShowSourceModal(false); setExcelUploadPending(false); }} 
          footer={null} 
          title={excelUploadPending ? "Upload Excel File" : "Select Data Source"} 
          centered
          className="source-modal"
        >
          {!excelUploadPending ? (
            <div className="data-source-options">
              {dataSources.map(src => (
                <Button
                  key={src.key}
                  icon={src.icon}
                  disabled={src.key !== 'excel'}
                  onClick={() => handleSelectSource(src.key)}
                  className="data-source-button"
                  size="large"
                >
                  {src.label}
                  {src.key !== 'excel' && <span className="coming-soon">Coming soon</span>}
                </Button>
              ))}
            </div>
          ) : (
            <div className="upload-section">
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
                className="excel-dragger"
              >
                <p className="ant-upload-drag-icon">
                  <InboxOutlined />
                </p>
                <p className="ant-upload-text">
                  Click or drag Excel file to this area to upload
                </p>
                <p className="ant-upload-hint">
                  Support for .xlsx and .xls files
                </p>
              </Dragger>
              <div className="upload-alternative">
                <span>Or </span>
                <input 
                  type="file" 
                  accept=".xlsx,.xls" 
                  onChange={handleExcelUpload} 
                  className="file-input"
                />
                <span> to browse files</span>
              </div>
            </div>
          )}
        </Modal>

        <Modal 
          open={showDeleteModal} 
          onOk={confirmDelete} 
          onCancel={cancelDelete} 
          title="Confirm Deletion" 
          okText="Delete" 
          cancelText="Cancel" 
          centered
          className="delete-modal"
        >
          <p>Are you sure you want to delete "{tableToDelete}"? This action cannot be undone.</p>
        </Modal>

        <Modal 
          open={showSaveQueryModal} 
          onOk={confirmSaveQuery} 
          onCancel={() => { setShowSaveQueryModal(false); setQueryName(""); }} 
          title="Save Query" 
          okText="Save" 
          cancelText="Cancel" 
          centered
          className="save-query-modal"
        >
          <div className="save-query-content">
            <label>Query Name:</label>
            <Input 
              placeholder="Enter query name..." 
              value={queryName} 
              onChange={e => setQueryName(e.target.value)} 
              onPressEnter={confirmSaveQuery} 
              autoFocus 
            />
            <div className="query-preview">
              <strong>Query Preview:</strong>
              <div className="query-preview-code">{query}</div>
            </div>
          </div>
        </Modal>
      </div>
    </AppLayout>
  );
};

export default DataPreparation;