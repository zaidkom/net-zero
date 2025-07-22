import React, { useState } from "react";
import { Button, Select, Input, Tabs, Typography, Table, message, Tooltip, Modal } from "antd";
import { PlusOutlined, ArrowLeftOutlined, FileExcelOutlined, DatabaseOutlined, CloudServerOutlined, DownloadOutlined, BarChartOutlined, AreaChartOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import axios from "axios";
import { clearLoggedIn } from '../auth';

const { Option } = Select;
const { TextArea } = Input;
const { Title } = Typography;

const dataSources = [
  { key: "oracle", label: "Oracle", icon: <DatabaseOutlined /> },
  { key: "sap", label: "SAP", icon: <CloudServerOutlined /> },
  { key: "excel", label: "Excel", icon: <FileExcelOutlined /> },
];

const mockData = [
  { key: 1, name: "Alice", age: 30, city: "London" },
  { key: 2, name: "Bob", age: 25, city: "Paris" },
];
const mockColumns = [
  { title: "Name", dataIndex: "name", key: "name" },
  { title: "Age", dataIndex: "age", key: "age" },
  { title: "City", dataIndex: "city", key: "city" },
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

const DataLoadTransform: React.FC = () => {
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
  const currentStage = 0; // Only first stage active for now

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

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      if (!bstr) return;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 });
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
        setSources(prev => [...prev, { tableName, sheetName: wsname, columns, data: tableData }]);
        setTableCounter(prev => prev + 1);
        setShowResults(true);
        setExcelUploadPending(false);
        setShowSourceModal(false);
        message.success(`Excel file loaded as ${tableName}!`);
      } else {
        message.warning("No data found in Excel file.");
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };

  return (
    <div className="nz-root">
      {/* Top Bar */}
      <div className="nz-topbar">
        <Title level={2} className="nz-title">Net Zero</Title>
        <Button style={{ float: 'right', marginLeft: 'auto' }} onClick={handleSignOut}>Sign Out</Button>
      </div>
      {/* Circular Stage Progress Bar */}
      <div className="nz-circular-timeline">
        {STAGES.map((stage, idx) => (
          <div key={stage.key} className="nz-circular-stage-container">
            {/* Arc/connector */}
            {idx > 0 && <div className={`nz-circular-arc${idx <= currentStage ? ' nz-circular-arc-active' : ''}`}></div>}
            {/* Circle */}
            <div className={`nz-circular-stage${idx === currentStage ? ' nz-circular-stage-active' : ''}`}> 
              <div className="nz-circular-stage-number">{`0${idx + 1}`}</div>
              <div className="nz-circular-stage-icon">{stage.icon}</div>
            </div>
            {/* Label */}
            <div className="nz-circular-stage-label">{stage.label}</div>
          </div>
        ))}
      </div>
      <div className="nz-main-fixed">
        {/* Left Pane: Settings & Data Source */}
        <div className="nz-left-pane-fixed">
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
            <Tooltip title="Add Data Source">
              <Button shape="circle" icon={<PlusOutlined />} size="large" className="nz-add-btn" onClick={handleAddSource} />
            </Tooltip>
            <span style={{ color: '#bfbfbf', marginLeft: 12, fontWeight: 500 }}>Add Data Source</span>
          </div>
          {/* List all added sources */}
          {sources.length > 0 && (
            <div style={{ marginTop: 24 }}>
              <div style={{ color: '#40a9ff', fontWeight: 600, marginBottom: 8 }}>Added Tables</div>
              {sources.map(src => (
                <div key={src.tableName} style={{ marginBottom: 8, fontSize: 13, color: '#bfbfbf', background: '#23272b', borderRadius: 6, padding: '6px 10px' }}>
                  <b>{src.tableName}</b> <span style={{ color: '#888' }}>(sheet: {src.sheetName})</span>
                </div>
              ))}
              <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                Use these table names in your SQL queries:<br />
                {sources.map(src => <span key={src.tableName}><b>{src.tableName}</b>{' '}</span>)}
              </div>
            </div>
          )}
        </div>
        {/* Center Pane: Query Editor & Results */}
        <div className="nz-center-pane-fixed">
          <div className="nz-query-editor-fixed">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <Tabs
                activeKey={queryType}
                onChange={(key) => setQueryType(key as "sql" | "python")}
                items={[
                  { key: "sql", label: "SQL" },
                  { key: "python", label: "Python" },
                ]}
                className="nz-tabs"
              />
              <Button type="primary" onClick={handleRun} loading={loading} className="nz-run-btn">
                Run
              </Button>
            </div>
            <TextArea
              rows={7}
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder={`Write your ${queryType.toUpperCase()} query here...`}
              className="nz-query-area"
            />
          </div>
          <div className="nz-results-pane-fixed">
            <Title level={5} style={{ color: "#40a9ff" }}>Results</Title>
            {/* Show backend result if available, else Excel data, else mock */}
            {resultData.length > 0 ? (
              <Table
                dataSource={resultData}
                columns={resultColumns}
                pagination={false}
                className="nz-table"
                scroll={{ x: true }}
              />
            ) : null}
            {/* Export Button */}
            {(resultData.length > 0) && (
              <Button
                icon={<DownloadOutlined />}
                style={{ marginTop: 16, float: 'right', background: '#40a9ff', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600 }}
                onClick={() => exportToCSV(
                  resultData,
                  resultColumns,
                  'data-preparation-export.csv'
                )}
              >
                Export
              </Button>
            )}
          </div>
        </div>
        {/* Right Pane: Navigation */}
        <div className="nz-right-pane-fixed">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(-1)}
            className="nz-back-btn"
          >
            Back
          </Button>
        </div>
      </div>
      {/* Modal for selecting data source and Excel upload */}
      <Modal
        open={showSourceModal}
        onCancel={() => { setShowSourceModal(false); setExcelUploadPending(false); }}
        footer={null}
        title={excelUploadPending ? "Upload Excel File" : "Select Data Source"}
        centered
      >
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
            <label style={{ color: '#40a9ff', fontWeight: 600, marginBottom: 8, display: 'block' }}>Choose Excel File</label>
            <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} style={{ color: '#fff', width: '100%' }} />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DataLoadTransform; 