import React, { useState, useEffect } from 'react';
import { Layout, Menu, Button, Dropdown, Avatar, Drawer } from 'antd';
import {
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  HomeOutlined,
  DatabaseOutlined,
  BarChartOutlined,
  AreaChartOutlined,
  UserOutlined,
  LogoutOutlined,
  ProfileOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, matchPath } from 'react-router-dom';
import './Layout.css';

const { Header, Sider, Content } = Layout;

const defaultNavItems = [
  { key: '/', label: 'Home', icon: <HomeOutlined /> },
  { key: '/data-preparation', label: 'Data Preparation', icon: <DatabaseOutlined /> },
  { key: '/data-analysis', label: 'Data Analysis', icon: <BarChartOutlined /> },
  { key: '/data-visualisation', label: 'Data Visualisation', icon: <AreaChartOutlined /> },
];

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [workflowName, setWorkflowName] = useState<string>("");
  const [workflowNavItems, setWorkflowNavItems] = useState<any[]>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Detect workflow context
  const workflowMatch = matchPath("/workflow/:workflowId/:stage", location.pathname);
  const workflowId = workflowMatch?.params?.workflowId;
  const workflowStage = workflowMatch?.params?.stage;

  // Fetch workflow name if in workflow context
  useEffect(() => {
    if (!workflowId) {
      setWorkflowName("");
      setWorkflowNavItems([]);
      return;
    }
    const fetchWorkflowName = async () => {
      try {
        const res = await fetch(`http://localhost:8000/workflows/${workflowId}`);
        if (!res.ok) throw new Error('Failed to fetch workflow');
        const data = await res.json();
        setWorkflowName(data.name || "");
      } catch (err) {
        setWorkflowName("");
      }
    };
    fetchWorkflowName();
    setWorkflowNavItems([
      { key: `/workflow/${workflowId}/data-preparation`, label: 'Data Preparation', icon: <DatabaseOutlined /> },
      { key: `/workflow/${workflowId}/data-analysis`, label: 'Data Analysis', icon: <BarChartOutlined /> },
      { key: `/workflow/${workflowId}/data-visualisation`, label: 'Data Visualisation', icon: <AreaChartOutlined /> },
    ]);
  }, [workflowId]);

  const handleMenuClick = ({ key }: any) => {
    if (key === 'signout') {
      localStorage.clear();
      window.location.href = '/login';
    } else if (key === 'profile') {
      // Profile logic here
    } else {
      navigate(key);
      setDrawerOpen(false);
    }
  };

  const userMenu = (
    <Menu onClick={handleMenuClick}>
      <Menu.Item key="profile" icon={<ProfileOutlined />}>Profile</Menu.Item>
      <Menu.Item key="signout" icon={<LogoutOutlined />}>Sign Out</Menu.Item>
    </Menu>
  );

  // Always include Home at the top
  const homeNavItem = { key: '/', label: 'Home', icon: <HomeOutlined /> };
  const navItems = workflowId
    ? [homeNavItem, ...workflowNavItems]
    : defaultNavItems;
  // Fix: Only highlight Home when on home, otherwise highlight the correct workflow nav item
  let selectedKeys: string[] = [];
  if (location.pathname === '/') {
    selectedKeys = ['/'];
  } else if (workflowId) {
    // Find the workflow nav item whose key matches the current path
    const match = workflowNavItems.find(item => location.pathname === item.key);
    if (match) {
      selectedKeys = [match.key];
    }
  } else {
    // For non-workflow pages, match the default nav item
    const match = defaultNavItems.find(item => location.pathname === item.key);
    if (match) {
      selectedKeys = [match.key];
    }
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Sidebar for desktop */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={0}
        trigger={null}
        width={240}
        className="app-sider"
        style={{ position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 100 }}
      >
        <div className="app-logo" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, color: '#7f8cff', letterSpacing: 2 }}>
          Net Zero
        </div>
        {/* Workflow name above nav if in workflow context */}
        {workflowId && workflowName && (
          <div style={{ fontWeight: 900, fontSize: 18, color: '#7f8cff', margin: '24px 0 8px 0', textAlign: 'center', letterSpacing: 1 }}>{workflowName}</div>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          style={{ flex: 1, background: 'transparent', border: 'none' }}
          items={navItems}
          onClick={handleMenuClick}
        />
        <Menu
          theme="dark"
          mode="inline"
          style={{ position: 'absolute', bottom: 0, width: '100%', background: 'transparent', border: 'none' }}
          items={[{ key: 'signout', label: 'Sign Out', icon: <LogoutOutlined /> }]}
          onClick={handleMenuClick}
        />
      </Sider>
      {/* Drawer for mobile */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        bodyStyle={{ padding: 0, background: '#23243a' }}
        width={220}
      >
        <div className="app-logo" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 24, color: '#7f8cff', letterSpacing: 2 }}>
          Net Zero
        </div>
        {workflowId && workflowName && (
          <div style={{ fontWeight: 900, fontSize: 18, color: '#7f8cff', margin: '24px 0 8px 0', textAlign: 'center', letterSpacing: 1 }}>{workflowName}</div>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          style={{ background: 'transparent', border: 'none' }}
          items={navItems}
          onClick={handleMenuClick}
        />
        <Menu
          theme="dark"
          mode="inline"
          style={{ position: 'absolute', bottom: 0, width: '100%', background: 'transparent', border: 'none' }}
          items={[{ key: 'signout', label: 'Sign Out', icon: <LogoutOutlined /> }]}
          onClick={handleMenuClick}
        />
      </Drawer>
      <Layout style={{ marginLeft: collapsed ? 0 : 240, transition: 'margin-left 0.2s' }}>
        <Header className="app-header" style={{ background: '#1e2235', padding: '0 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 64, position: 'sticky', top: 0, zIndex: 99 }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            style={{ fontSize: 22, color: '#fff', marginRight: 16, display: 'none', border: 'none' }}
            className="app-hamburger"
          />
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setDrawerOpen(true)}
            style={{ fontSize: 22, color: '#fff', marginRight: 16, display: 'block', border: 'none' }}
            className="app-hamburger-mobile"
          />
          <div style={{ flex: 1 }} />
          <Dropdown overlay={userMenu} placement="bottomRight" trigger={["click"]}>
            <Avatar size={40} style={{ background: 'linear-gradient(135deg, #7f8cff 0%, #e14eca 100%)', cursor: 'pointer' }} icon={<UserOutlined />} />
          </Dropdown>
        </Header>
        <Content style={{ margin: '32px 24px 0 24px', minHeight: 'calc(100vh - 64px)', background: 'transparent' }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout; 