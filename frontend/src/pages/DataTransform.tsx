import React, { useState } from 'react';
import { Table, Tabs, Input, Button, message, Card, Empty } from 'antd';
import axios from 'axios';
import { clearLoggedIn } from '../auth';
import { useNavigate } from 'react-router-dom';

const { TabPane } = Tabs;

const DataTransform = ({ data, columns }: any) => {
  const [activeTab, setActiveTab] = useState('sql');
  const [code, setCode] = useState('');
  const [transformedData, setTransformedData] = useState<any[]>([]);
  const [transformedColumns, setTransformedColumns] = useState<any[]>([]);
  const navigate = useNavigate();
  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };

  const handleRun = async () => {
    if (!code.trim()) {
      message.warning('Please enter transformation code.');
      return;
    }
    try {
      const response = await axios.post('http://localhost:8000/transform', {
        data,
        code,
        mode: activeTab,
      });
      if (response.data.error) {
        message.error(response.data.error);
        setTransformedData([]);
        setTransformedColumns([]);
        return;
      }
      let { data: tData, columns: tColumns } = response.data;
      tData = tData.map((row: any, idx: number) => ({ ...row, key: idx }));
      setTransformedData(tData);
      setTransformedColumns(tColumns);
      message.success('Transformation successful!');
    } catch (err) {
      message.error('Transformation failed');
    }
  };

  const handleExport = () => {
    message.info('Export to Excel not implemented yet.');
    // TODO: Implement export functionality
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Transform Data</h2>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>
      <Card
        title="Transformation Editor"
        style={{ marginBottom: 24 }}
        bodyStyle={{ padding: 16 }}
      >
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab="SQL" key="sql">
            <Input.TextArea
              rows={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Write SQL transformation here (e.g., SELECT * FROM df WHERE ...)"
            />
          </TabPane>
          <TabPane tab="Python" key="python">
            <Input.TextArea
              rows={6}
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="Write Python code here (e.g., df = df[df['col'] > 0])"
            />
          </TabPane>
        </Tabs>
        <Button type="primary" onClick={handleRun} style={{ marginTop: 16 }}>
          Run
        </Button>
      </Card>

      <Card
        title="Transformed Data"
        style={{
          background: '#fafcff',
          borderRadius: 8,
          boxShadow: '0 2px 8px #f0f1f2',
        }}
        bodyStyle={{ padding: 16 }}
      >
        {transformedData && transformedData.length > 0 ? (
          <Table
            className="small-table"
            dataSource={transformedData}
            columns={transformedColumns}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            size="small"
            bordered
            scroll={{ x: true, y: 320 }}
            style={{ minHeight: 200 }}
          />
        ) : (
          <Empty description="No transformed data yet" />
        )}
      </Card>

      <Button onClick={handleExport} style={{ marginTop: 16 }}>
        Export to Excel
      </Button>
    </div>
  );
};

export default DataTransform;