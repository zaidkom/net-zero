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

  // For collapsed state, show only icons
  const collapsedNavItems = navItems.map(item => ({
    ...item,
    label: collapsed ? null : item.label,
  }));

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
    <Layout className="app-layout-root">
      {/* Sidebar for desktop */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        breakpoint="lg"
        collapsedWidth={64}
        trigger={null}
        width={240}
        className="app-sider"
      >
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 8 }}>
            <Button
              type="text"
              icon={<MenuUnfoldOutlined />}
              onClick={() => setCollapsed(false)}
              className="app-hamburger"
              style={{ fontSize: 22, color: '#fff', marginBottom: 16 }}
            />
            <Menu
              theme="dark"
              mode="vertical"
              selectedKeys={selectedKeys}
              className="app-menu"
              items={defaultNavItems.map(item => ({ ...item, label: null }))}
              onClick={handleMenuClick}
              style={{ border: 'none', background: 'transparent' }}
            />
          </div>
        ) : (
          <>
            <div className="app-logo">Net Zero Analytics</div>
            {workflowId && workflowName && (
              <div className="workflow-name">{workflowName}</div>
            )}
            <Menu
              theme="dark"
              mode="inline"
              selectedKeys={selectedKeys}
              className="app-menu"
              items={navItems}
              onClick={handleMenuClick}
            />
          </>
        )}
      </Sider>
      {/* Drawer for mobile */}
      <Drawer
        placement="left"
        closable={false}
        onClose={() => setDrawerOpen(false)}
        open={drawerOpen}
        className="app-drawer"
      >
        <div className="app-logo app-logo-mobile">
          Net Zero
        </div>
        {workflowId && workflowName && (
          <div className="workflow-name workflow-name-mobile">{workflowName}</div>
        )}
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={selectedKeys}
          className="app-menu"
          items={navItems}
          onClick={handleMenuClick}
        />
        <Menu
          theme="dark"
          mode="inline"
          className="app-menu app-menu-bottom"
          items={[{ key: 'signout', label: 'Sign Out', icon: <LogoutOutlined /> }]}
          onClick={handleMenuClick}
        />
      </Drawer>
      <Layout className={collapsed ? "app-main-collapsed" : "app-main"}>
        <Header className="app-header">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="app-hamburger"
          />
          <Button
            type="text"
            icon={<MenuUnfoldOutlined />}
            onClick={() => setDrawerOpen(true)}
            className="app-hamburger-mobile"
          />
          <div className="app-header-spacer" />
          <Dropdown overlay={userMenu} placement="bottomRight" trigger={["click"]}>
            <Avatar size={40} className="app-avatar" icon={<UserOutlined />} />
          </Dropdown>
        </Header>
        <Content className="app-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout; 