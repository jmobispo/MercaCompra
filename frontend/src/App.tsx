import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import DemoBanner from './components/DemoBanner';
import Layout from './components/layout/Layout';
import AutomationPage from './pages/AutomationPage';
import DashboardPage from './pages/DashboardPage';
import FavoritesPage from './pages/FavoritesPage';
import ListDetailPage from './pages/ListDetailPage';
import ListsPage from './pages/ListsPage';
import LoginPage from './pages/LoginPage';
import PantryPage from './pages/PantryPage';
import ProductsPage from './pages/ProductsPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import RecipesPage from './pages/RecipesPage';
import RegisterPage from './pages/RegisterPage';
import SpendingPage from './pages/SpendingPage';
import SupermarketModePage from './pages/SupermarketModePage';
import WeeklyPlanDetailPage from './pages/WeeklyPlanDetailPage';
import WeeklyPlansPage from './pages/WeeklyPlansPage';
import { useAuthStore } from './store/authStore';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <DemoBanner />
      <Routes>
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <RegisterPage />
            </PublicRoute>
          }
        />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="favorites" element={<FavoritesPage />} />
          <Route path="weekly-plans" element={<WeeklyPlansPage />} />
          <Route path="weekly-plans/:id" element={<WeeklyPlanDetailPage />} />
          <Route path="lists" element={<ListsPage />} />
          <Route path="lists/:id" element={<ListDetailPage />} />
          <Route path="lists/:id/supermarket" element={<SupermarketModePage />} />
          <Route path="automation" element={<AutomationPage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/:id" element={<RecipeDetailPage />} />
          <Route path="spending" element={<SpendingPage />} />
          <Route path="pantry" element={<PantryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
