import React from 'react';
import { Button, Collapse, Tooltip } from 'antd';
import { PlayCircleOutlined, DeleteOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

interface SavedQueriesPanelProps {
  savedQueries: Array<{id: string, name: string, query: string, type: "sql" | "python"}>;
  onLoadQuery: (query: {id: string, name: string, query: string, type: "sql" | "python"}) => void;
  onDeleteQuery: (queryId: string) => void;
}

const SavedQueriesPanel: React.FC<SavedQueriesPanelProps> = ({
  savedQueries,
  onLoadQuery,
  onDeleteQuery
}) => {
  return (
    <div className="panel-section">
      <div className="panel-header">
        <h3>Saved Queries</h3>
        <span className="query-count">{savedQueries.length}</span>
      </div>
      
      <Collapse ghost className="queries-collapse">
        {savedQueries.map(queryObj => (
          <Panel 
            header={
              <div className="query-header">
                <div className="query-names-left">
                  <span className="query-name">{queryObj.name}</span>
                  <span className="query-type">{queryObj.type.toUpperCase()}</span>
                </div>
                <div className="query-actions">
                  <Tooltip title="Load Query">
                    <Button 
                      type="text" 
                      icon={<PlayCircleOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoadQuery(queryObj);
                      }}
                      className="load-button"
                      size="small"
                    />
                  </Tooltip>
                  <Tooltip title="Delete Query">
                    <Button 
                      type="text" 
                      icon={<DeleteOutlined />} 
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteQuery(queryObj.id);
                      }}
                      className="delete-button"
                      size="small"
                      danger
                    />
                  </Tooltip>
                </div>
              </div>
            }
            key={queryObj.id}
            className="query-panel"
          >
            <div className="query-preview">
              <pre>{queryObj.query}</pre>
            </div>
          </Panel>
        ))}
      </Collapse>
    </div>
  );
};

export default SavedQueriesPanel;