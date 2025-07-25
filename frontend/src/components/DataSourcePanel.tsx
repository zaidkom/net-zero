import React, { useState } from 'react';
import { Button, Collapse, Input } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

interface DataSourcePanelProps {
  sources: any[];
  onAddSource: () => void;
  onRefreshSources: () => void;
  onEditTableName: (tableName: string) => void;
  onDeleteTable: (tableName: string) => void;
  editingTableName: string | null;
  newTableName: string | null;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  setNewTableName: (name: string) => void;
  showDataTypes: boolean;
  onColumnDrag?: (columnText: string) => void;
}

const DataSourcePanel: React.FC<DataSourcePanelProps> = ({
  sources,
  onAddSource,
  onRefreshSources,
  onEditTableName,
  onDeleteTable,
  editingTableName,
  newTableName,
  onSaveEdit,
  onCancelEdit,
  setNewTableName,
  showDataTypes,
  onColumnDrag
}) => {
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, columnText: string) => {
    // Split the column text into table and column parts
    const parts = columnText.split('.');
    if (parts.length === 2) {
      const tableName = parts[0];
      const columnName = parts[1];
      // Wrap both table and column names in quotations
      const quotedText = `"${tableName}"."${columnName}"`;
      e.dataTransfer.setData('text/plain', quotedText);
    } else {
      e.dataTransfer.setData('text/plain', columnText);
    }
    e.dataTransfer.effectAllowed = 'copy';
    setDraggedColumn(columnText);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    setDraggedColumn(null);
  };

  return (
    <div className="panel-section">
      <div className="panel-header">
        <h3>Data Sources</h3>
        <div className="panel-actions">
          <Button 
            type="text" 
            shape="circle" 
            icon={<ReloadOutlined />} 
            onClick={onRefreshSources}
            className="refresh-source-button"
            title="Refresh data sources"
          />
          <Button 
            type="primary" 
            shape="circle" 
            icon={<PlusOutlined />} 
            onClick={onAddSource}
            className="add-source-button"
          />
        </div>
      </div>
      
      {sources.length > 0 && (
        <Collapse ghost className="sources-collapse">
          {sources.map(src => (
            <Panel 
              header={
                <div className="source-header">
                  {editingTableName === src.tableName ? (
                    <div className="edit-name-container">
                      <Input
                        value={newTableName || ''}
                        onChange={e => setNewTableName(e.target.value)}
                        onPressEnter={onSaveEdit}
                        className="edit-name-input"
                        size="small"
                      />
                      <div className="edit-actions">
                        <Button 
                          type="text" 
                          icon={<CheckOutlined />} 
                          onClick={onSaveEdit}
                          className="save-edit-button"
                          size="small"
                        />
                        <Button 
                          type="text" 
                          icon={<CloseOutlined />} 
                          onClick={onCancelEdit}
                          className="cancel-edit-button"
                          size="small"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="source-name-container">
                      <div className="source-names-left">
                        <span className="table-name">{src.tableName}</span>
                      </div>
                      <div className="table-actions">
                        <Button 
                          type="text" 
                          icon={<EditOutlined />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditTableName(src.tableName);
                          }}
                          className="edit-button"
                          size="small"
                        />
                        <Button 
                          type="text" 
                          icon={<DeleteOutlined />} 
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteTable(src.tableName);
                          }}
                          className="delete-button"
                          size="small"
                          danger
                        />
                      </div>
                    </div>
                  )}
                </div>
              }
              key={src.tableName}
              className="source-panel"
            >
              <div className="columns-list">
                {src.columns.map((col: any) => {
                  const columnText = `${src.tableName}.${col.title}`;
                  const isDragging = draggedColumn === columnText;
                  
                  return (
                    <div 
                      key={col.dataIndex} 
                      className={`column-item draggable-column ${isDragging ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, columnText)}
                      onDragEnd={handleDragEnd}
                      title={`Drag to insert: ${columnText}`}
                    >
                      <span className="column-name">{col.title}</span>
                      {showDataTypes && col.dataType && (
                        <span className="column-type">{col.dataType}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Panel>
          ))}
        </Collapse>
      )}
    </div>
  );
};

export default DataSourcePanel;