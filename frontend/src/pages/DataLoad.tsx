import React from 'react';
import { Typography, Button } from 'antd';
import { clearLoggedIn } from '../auth';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

const DataLoad = () => {
  const navigate = useNavigate();
  const handleSignOut = () => {
    clearLoggedIn();
    navigate('/login');
  };
  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={2}>Welcome to Net Zero Analytics</Title>
        <Button onClick={handleSignOut}>Sign Out</Button>
      </div>
      <Paragraph>
        Use the left pane to upload your Excel or CSV file and select a sheet. The data preview will always be visible at the bottom. Once your data is loaded, click "Next" to proceed to transformations.
      </Paragraph>
      <Paragraph>
        <b>Tip:</b> You can always return to this page to load a new file or switch sheets.
      </Paragraph>
    </div>
  );
};

export default DataLoad;