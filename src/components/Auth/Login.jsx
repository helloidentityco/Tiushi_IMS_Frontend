import React, { useState } from 'react';
import { 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  ArrowRight,
  Warehouse
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import api from '../../api/axiosConfig';

export default function Login() {
  const { login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setIsLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password;

    try {
      const response = await api.post('/auth/login', {
        email: cleanEmail,
        password: cleanPassword,
      });

      if (response.data?.success && response.data?.data) {
        const userData = response.data.data;
        if (userData.token) {
          localStorage.setItem('token', userData.token);
        }
        login({
          id: userData.id,
          email: userData.email,
          name: userData.name || userData.email.split('@')[0],
          role: userData.role,
        });
      } else {
        setErrorMessage(response.data?.message || 'Login failed. Please verify credentials.');
      }
    } catch (err) {
      console.error('Login error:', err);
      const serverMessage =
        err.response?.data?.message ||
        (err.response?.data?.errors && err.response.data.errors[0]?.message) ||
        (err.response?.status === 401 ? 'Invalid email or password.' : null) ||
        (err.response?.status === 403 ? 'Account deactivated. Please contact administrator.' : null) ||
        (err.message === 'Network Error'
          ? 'Cannot reach backend server. Please verify backend is running on http://localhost:5000.'
          : null) ||
        'Authentication failed. Please try again.';

      setErrorMessage(serverMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 flex items-center justify-center p-4 sm:p-6 lg:p-8 font-sans selection:bg-indigo-500 selection:text-white">
      <div className="w-full max-w-md mx-auto space-y-6">
        
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center mb-2">
            <span className="p-3 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white shadow-xl shadow-indigo-600/30">
              <Warehouse className="w-8 h-8" />
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            Identity Inventory &amp; POS
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 max-w-xs mx-auto">
            Manufacturing resource planning and multi-warehouse operations.
          </p>
        </div>

        {/* Centered Login Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {/* Top decorative accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

          <div className="mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Sign In to Account</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Enter your authorized credentials to access the system.
            </p>
          </div>

          {/* Error Message Box */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-300 text-xs font-semibold flex items-center gap-2.5 animate-shake">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-300 block">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="e.g. admin@mail.com"
                  className="w-full pl-10 pr-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-medium transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-gray-300 block">
                  Password
                </label>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-500 hover:text-gray-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-3 px-4 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-50 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Offline Readiness Badge */}
          <div className="mt-6 pt-5 border-t border-gray-800/80 flex items-center justify-between text-[11px] text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>Dexie IndexedDB Ready</span>
            </span>
            <span>Enterprise Security Protected</span>
          </div>
        </div>

      </div>
    </div>
  );
}
