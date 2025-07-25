import React, { useState } from 'react';
import { Button, Input, Table, Typography, Pagination } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';

const { Title } = Typography;

interface ResultsTableProps {
  resultData: any[];
  resultColumns: any[];
  searchText: string;
  setSearchText: (text: string) => void;
  onExport: () => void;
}

const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

const ResultsTable: React.FC<ResultsTableProps> = ({
  resultData,
  resultColumns,
  searchText,
  setSearchText,
  onExport
}) => {
  const [pageSize, setPageSize] = useState(50);
  const [current, setCurrent] = useState(1);

  const handlePageChange = (page: number, size?: number) => {
    setCurrent(page);
    if (size && size !== pageSize) {
      setPageSize(size);
      setCurrent(1);
    }
  };

  return (
    <div className="results-table">
      <div className="results-header">
        <div className="results-title">
          <Title level={4}>Query Results</Title>
          {resultData.length > 0 && (
            <span className="row-count">{resultData.length} rows</span>
          )}
        </div>
        <div className="results-actions">
          {resultData.length > 0 && (
            <>
              <Pagination
                className="results-pagination"
                simple={false}
                current={current}
                pageSize={pageSize}
                total={resultData.length}
                showSizeChanger
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                onChange={handlePageChange}
                onShowSizeChange={handlePageChange}
                style={{ marginRight: 12 }}
              />
              <Input
                placeholder="Search results..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="search-input"
                allowClear
              />
              <Button 
                type="primary"
                icon={<DownloadOutlined />} 
                onClick={onExport}
                className="export-button"
              >
                Export CSV
              </Button>
            </>
          )}
        </div>
      </div>
      {resultData.length > 0 ? (
        <div className="table-container">
          <Table 
            dataSource={resultData} 
            columns={resultColumns.map(col => ({ 
              ...col, 
              sorter: (a: any, b: any) => String(a[col.dataIndex]).localeCompare(String(b[col.dataIndex])),
              ellipsis: true
            }))} 
            pagination={{
              current,
              pageSize,
              total: resultData.length,
              showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} items`,
              showSizeChanger: false,
              onChange: handlePageChange,
            }}
            size="small" 
            bordered 
            scroll={{ x: true, y: 400 }}
            className="results-table-component"
          />
        </div>
      ) : (
        <div className="empty-results">
          <p>No results to display. Run a query to see data here.</p>
        </div>
      )}
    </div>
  );
};

export default ResultsTable;