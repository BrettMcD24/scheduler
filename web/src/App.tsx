import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import EmployeeLayout from "./components/EmployeeLayout";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./lib/auth";
import Approvals from "./pages/Approvals";
import Builder from "./pages/Builder";
import CallOffs from "./pages/CallOffs";
import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import Login from "./pages/Login";
import SwapHistory from "./pages/SwapHistory";
import Availability from "./pages/employee/Availability";
import MyShifts from "./pages/employee/MyShifts";
import StoreSchedule from "./pages/employee/StoreSchedule";
import Swaps from "./pages/employee/Swaps";
import TimeOff from "./pages/employee/TimeOff";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div style={{ padding: 40 }}>Loading…</div>;
  if (!user) return <Login />;

  const isManager = user.role === "manager" || user.role === "super_admin";

  if (isManager) {
    return (
      <Routes>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/builder" element={<Builder />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/call-offs" element={<CallOffs />} />
          <Route path="/swap-history" element={<SwapHistory />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    );
  }

  // Employee self-service
  return (
    <Routes>
      <Route element={<EmployeeLayout />}>
        <Route path="/my-shifts" element={<MyShifts />} />
        <Route path="/schedule" element={<StoreSchedule />} />
        <Route path="/swaps" element={<Swaps />} />
        <Route path="/time-off" element={<TimeOff />} />
        <Route path="/availability" element={<Availability />} />
        <Route path="*" element={<Navigate to="/my-shifts" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Protected />
      </BrowserRouter>
    </AuthProvider>
  );
}
