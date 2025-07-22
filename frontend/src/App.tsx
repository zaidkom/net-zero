import React from "react";
import { Routes, Route, useNavigate, useLocation, Navigate, useParams } from "react-router-dom";
import DataPreparation from "./pages/DataPreparation";
import DataAnalysis from "./pages/DataAnalysis";
import DataVisualisation from "./pages/DataVisualisation";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Homepage from "./pages/Homepage";
import { useState } from "react";
import "antd/dist/reset.css";
import "./App.css";
import { isLoggedIn } from "./auth";

const STAGE_ROUTES = [
  { path: "/data-preparation", component: DataPreparation },
  { path: "/data-analysis", component: DataAnalysis },
  { path: "/data-visualisation", component: DataVisualisation },
];

function ProtectedRoute({ children }: { children: JSX.Element }) {
  if (!isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const [selectedWorkflow, setSelectedWorkflow] = useState(null);
  // Determine current stage by route
  const currentStage = STAGE_ROUTES.findIndex(r => location.pathname.startsWith(r.path));
  const handleStageClick = (idx: number) => {
    navigate(STAGE_ROUTES[idx].path);
  };
  const handleSelectWorkflow = (workflow: any) => {
    setSelectedWorkflow(workflow);
    navigate(`/workflow/${workflow.id}/data-preparation`);
  };
  const handleCreateWorkflow = (workflow: any) => {
    setSelectedWorkflow(workflow);
    navigate(`/workflow/${workflow.id}/data-preparation`);
  };
  // Workflow-specific route wrappers
  const WorkflowDataPreparation = () => {
    const { workflowId } = useParams();
    return <DataPreparation workflowId={workflowId} />;
  };
  const WorkflowDataAnalysis = () => {
    const { workflowId } = useParams();
    return <DataAnalysis workflowId={workflowId} />;
  };
  const WorkflowDataVisualisation = () => {
    const { workflowId } = useParams();
    return <DataVisualisation workflowId={workflowId} />;
  };
  return (
    <Routes>
      <Route path="/signup" element={<Signup />} />
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Homepage onSelectWorkflow={handleSelectWorkflow} onCreateWorkflow={handleCreateWorkflow} /></ProtectedRoute>} />
      <Route path="/workflow/:workflowId/data-preparation" element={<ProtectedRoute><WorkflowDataPreparation /></ProtectedRoute>} />
      <Route path="/workflow/:workflowId/data-analysis" element={<ProtectedRoute><WorkflowDataAnalysis /></ProtectedRoute>} />
      <Route path="/workflow/:workflowId/data-visualisation" element={<ProtectedRoute><WorkflowDataVisualisation /></ProtectedRoute>} />
      {/* Legacy routes for now */}
      <Route path="/data-preparation" element={<ProtectedRoute><DataPreparation currentStage={0} onStageClick={handleStageClick} /></ProtectedRoute>} />
      <Route path="/data-analysis" element={<ProtectedRoute><DataAnalysis currentStage={1} onStageClick={handleStageClick} /></ProtectedRoute>} />
      <Route path="/data-visualisation" element={<ProtectedRoute><DataVisualisation currentStage={2} onStageClick={handleStageClick} /></ProtectedRoute>} />
    </Routes>
  );
}

export default App;