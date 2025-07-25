import React, { useRef, useState } from 'react';
import { Button, Tabs } from 'antd';
import { PlayCircleOutlined, SaveOutlined } from '@ant-design/icons';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';

interface QueryEditorProps {
  queryType: "sql" | "python";
  setQueryType: (type: "sql" | "python") => void;
  query: string;
  setQuery: (query: string) => void;
  onRun: () => void;
  onSave: () => void;
  loading: boolean;
}

const QueryEditor: React.FC<QueryEditorProps> = ({
  queryType,
  setQueryType,
  query,
  setQuery,
  onRun,
  onSave,
  loading
}) => {
  const editorRef = useRef<any>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const columnText = e.dataTransfer.getData('text/plain');
    
    if (columnText && editorRef.current) {
      // Get the current cursor position from CodeMirror
      const view = editorRef.current.view;
      if (view) {
        const pos = view.state.selection.main.head;
        
        // Insert the column text at the cursor position
        const newQuery = query.slice(0, pos) + columnText + query.slice(pos);
        setQuery(newQuery);
        
        // Set cursor position after the inserted text
        setTimeout(() => {
          if (view) {
            const newPos = pos + columnText.length;
            view.dispatch({
              selection: { anchor: newPos, head: newPos }
            });
          }
        }, 0);
      }
    }
  };

  return (
    <div className="query-editor">
      <div className="editor-header">
        <Tabs
          activeKey={queryType}
          onChange={(key) => setQueryType(key as "sql" | "python")}
          items={[
            { key: "sql", label: "SQL" },
            { key: "python", label: "Python" },
          ]}
          className="query-tabs"
        />
        <div className="editor-actions">
          <Button 
            type="primary" 
            icon={<PlayCircleOutlined />}
            onClick={onRun} 
            loading={loading} 
            className="run-button"
          >
            Run Query
          </Button>
          <Button 
            icon={<SaveOutlined />}
            onClick={onSave} 
            disabled={!query.trim()}
            className="save-query-button"
          >
            Save Query
          </Button>
        </div>
      </div>
      
      <div 
        className={`code-editor droppable-editor ${isDragOver ? 'drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <CodeMirror
          ref={editorRef}
          value={query}
          height="130px"
          theme={oneDark}
          extensions={[queryType === 'sql' ? sql() : python()]}
          onChange={setQuery}
          basicSetup={{
            lineNumbers: true,
            highlightActiveLine: true,
            foldGutter: true,
            autocompletion: true,
          }}
          placeholder={`Enter your ${queryType.toUpperCase()} query here...`}
        />
      </div>
    </div>
  );
};

export default QueryEditor;