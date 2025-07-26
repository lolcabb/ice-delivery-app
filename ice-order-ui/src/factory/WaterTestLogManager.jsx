import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, Plus, Calendar, AlertTriangle, X, BarChart3, Search, Filter } from 'lucide-react';
import { apiService } from '../apiService';
import { getISODate } from '../utils/dateUtils';


import WaterDashboard from './WaterDashboard';
import WaterLogForm from './WaterLogForm';

export default function WaterTestLogManager() {
    const [logs, setLogs] = useState([]);
    const [stages, setStages] = useState([]);
    const [selectedDate, setSelectedDate] = useState(getISODate(new Date()));
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [showLogForm, setShowLogForm] = useState(false);
    const [showDashboard, setShowDashboard] = useState(true);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('All');
    const [sessionFilter, setSessionFilter] = useState('All');

    // Form data for logging tests
    const [formData, setFormData] = useState({});
    
    // Dashboard data
    const [dashboardData, setDashboardData] = useState({
        recentLogs: [],
        dangerousValues: [],
        trends: {},
        averages: {}
    });

    // Water quality danger thresholds
    const dangerThresholds = {
        ph_value: { min: 6.5, max: 8.5, unit: 'pH' },
        tds_ppm_value: { min: 0, max: 500, unit: 'ppm' },
        ec_us_cm_value: { min: 0, max: 1000, unit: 'µS/cm' }
    };

    const fetchStages = useCallback(async () => {
        try {
            const data = await apiService.get('/water/stages');
            setStages(Array.isArray(data) ? data : []);
            
            // Initialize form data structure based on stages
            const initialFormData = {};
            data.forEach(stage => {
                initialFormData[stage.stage_id] = {
                    morning: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' },
                    afternoon: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' }
                };
            });
            setFormData(initialFormData);
        } catch (err) {
            console.error('Error fetching stages:', err);
            setError('Failed to fetch water test stages.');
        }
    }, []);

    const fetchLogs = useCallback(async (date) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.get(`/water/logs?date=${date}`);
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching water logs:', err);
            if (err.status === 404) {
                setLogs([]);
                setError('No water test log');
            } else {
                setError('Failed to fetch water logs. Please try again.');
            }
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchDashboardData = useCallback(async () => {
        try {
            // Get recent logs for dashboard (last 7 days)
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 7);
            
            const formatDate = (d) => getISODate(d);

            const query = new URLSearchParams({
                start_date: formatDate(startDate),
                end_date: formatDate(endDate)
            }).toString();

            const recentLogs = await apiService.get(`/water/logs/recent?${query}`);
            
            // Calculate dangerous values
            const dangerousValues = [];
            recentLogs.forEach(log => {
                Object.keys(dangerThresholds).forEach(param => {
                    const value = log[param];
                    const threshold = dangerThresholds[param];
                    if (value && (value < threshold.min || value > threshold.max)) {
                        dangerousValues.push({
                            ...log,
                            parameter: param,
                            value: value,
                            threshold: threshold,
                            severity: value < threshold.min * 0.8 || value > threshold.max * 1.2 ? 'high' : 'medium'
                        });
                    }
                });
            });

            setDashboardData({
                recentLogs: recentLogs || [],
                dangerousValues,
                trends: calculateTrends(recentLogs || []),
                averages: calculateAverages(recentLogs || [])
            });
        } catch (err) {
            console.error('Failed to fetch dashboard data:', err);
        }
    }, []);

    const calculateTrends = (logs) => {
        const trends = {};
        const parameters = ['ph_value', 'tds_ppm_value', 'ec_us_cm_value'];
        
        parameters.forEach(param => {
            const values = logs.filter(log => log[param]).map(log => log[param]);
            if (values.length >= 2) {
                const recent = values.slice(-3).reduce((a, b) => a + b, 0) / Math.min(3, values.length);
                const older = values.slice(0, -3).reduce((a, b) => a + b, 0) / Math.max(1, values.length - 3);
                trends[param] = recent > older ? 'up' : recent < older ? 'down' : 'stable';
            } else {
                trends[param] = 'stable';
            }
        });
        
        return trends;
    };

    const calculateAverages = (logs) => {
        const averages = {};
        const parameters = ['ph_value', 'tds_ppm_value', 'ec_us_cm_value'];
        
        parameters.forEach(param => {
            const values = logs.filter(log => log[param]).map(log => log[param]);
            averages[param] = values.length > 0 ? 
                (values.reduce((a, b) => a + b, 0) / values.length).toFixed(2) : 
                'N/A';
        });
        
        return averages;
    };

    useEffect(() => {
        fetchStages();
        fetchDashboardData();
    }, [fetchStages, fetchDashboardData]);

    useEffect(() => {
        fetchLogs(selectedDate);
    }, [selectedDate, fetchLogs]);

    const resetForm = useCallback(() => {
        const reset = {};
        stages.forEach(stage => {
            reset[stage.stage_id] = {
                morning: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' },
                afternoon: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' }
            };
        });
        setFormData(reset);
    }, [stages]);

    useEffect(() => {
        if (showLogForm) {
            if (logs.length > 0) {
                const existingData = {};
                stages.forEach(s => {
                    existingData[s.stage_id] = { morning: {}, afternoon: {} };
                });
                logs.forEach(log => {
                    const sessionKey = log.test_session.toLowerCase();
                    if (!existingData[log.stage_id]) {
                        existingData[log.stage_id] = { morning: {}, afternoon: {} };
                    }
                    existingData[log.stage_id][sessionKey] = {
                        ph_value: log.ph_value || '',
                        tds_ppm_value: log.tds_ppm_value || '',
                        ec_us_cm_value: log.ec_us_cm_value || ''
                    };
                });
                setFormData(existingData);
            }
        } else {
            resetForm();
        }
    }, [showLogForm, logs, stages, resetForm]);

    useEffect(() => {
        resetForm();
    }, [selectedDate, resetForm]);

    const handleSubmitLogs = async () => {
        setLoading(true);
        try {
            const logsToSubmit = [];
            
            // Convert form data to individual log entries
            Object.keys(formData).forEach(stageId => {
                const stageData = formData[stageId];
                ['morning', 'afternoon'].forEach(session => {
                    const sessionData = stageData[session];
                    if (sessionData && (sessionData.ph_value || sessionData.tds_ppm_value || sessionData.ec_us_cm_value)) {
                        logsToSubmit.push({
                            stage_id: parseInt(stageId),
                            test_session: session.charAt(0).toUpperCase() + session.slice(1),
                            test_timestamp: new Date(`${selectedDate}T${session === 'morning' ? '08:00:00' : '14:00:00'}Z`).toISOString(),
                            ph_value: sessionData.ph_value || null,
                            tds_ppm_value: sessionData.tds_ppm_value || null,
                            ec_us_cm_value: sessionData.ec_us_cm_value || null
                        });
                    }
                });
            });

            // Submit all logs
            for (const logData of logsToSubmit) {
                await apiService.post('/water/logs', logData);
            }

            // Refresh data
            await Promise.all([
                fetchLogs(selectedDate),
                fetchDashboardData()
            ]);

            setShowLogForm(false);
            
            // Reset form
            const resetFormData = {};
            stages.forEach(stage => {
                resetFormData[stage.stage_id] = {
                    morning: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' },
                    afternoon: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '' }
                };
            });
            setFormData(resetFormData);
            setError(null);
        } catch (err) {
            console.error('Failed to submit water test logs:', err);
            setError('Failed to submit water test logs. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const isValueDangerous = (parameter, value) => {
        if (!value || !dangerThresholds[parameter]) return false;
        const threshold = dangerThresholds[parameter];
        return value < threshold.min || value > threshold.max;
    };

    const getValueColor = (parameter, value) => {
        if (!value) return 'text-gray-500';
        if (isValueDangerous(parameter, value)) {
            return 'text-red-600 font-semibold';
        }
        return 'text-green-600';
    };

    const filteredLogs = logs.filter(log => {
        const matchesSearch = searchTerm === '' || 
            log.stage_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.recorded_by?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStage = stageFilter === 'All' || log.stage_name === stageFilter;
        const matchesSession = sessionFilter === 'All' || log.test_session === sessionFilter;
        
        return matchesSearch && matchesStage && matchesSession;
    });

    return (
        <div className="p-0 sm:p-2 lg:p-4">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Droplets className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Water Quality Testing System</h1>
                                <p className="text-gray-600">Monitor water quality across all treatment stages</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDashboard(!showDashboard)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                                    showDashboard 
                                        ? 'bg-blue-600 text-white' 
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                <BarChart3 className="w-5 h-5" />
                                Dashboard
                            </button>
                            <button
                                onClick={() => setShowLogForm(true)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                Log Tests
                            </button>
                        </div>
                    </div>
                </div>

                {/* Dashboard Section - Replace with WaterDashboard component */}
                {showDashboard && (
                        <WaterDashboard
                            dashboardData={dashboardData}
                            dangerThresholds={dangerThresholds}
                        />
                )}

                {/* Date Selector and Filters */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex flex-col lg:flex-row gap-4 items-center">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-gray-400" />
                            <label className="text-sm font-medium text-gray-700">Test Date:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            />
                        </div>
                        
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <input
                                    type="text"
                                    placeholder="Search by stage or recorded by..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <select
                                value={stageFilter}
                                onChange={(e) => setStageFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">All Stages</option>
                                {stages.map(stage => (
                                    <option key={stage.stage_id} value={stage.stage_name}>{stage.stage_name}</option>
                                ))}
                            </select>
                            <select
                                value={sessionFilter}
                                onChange={(e) => setSessionFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">All Sessions</option>
                                <option value="Morning">Morning</option>
                                <option value="Afternoon">Afternoon</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Error Message */}
                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500" />
                            <p className="text-red-700">{error}</p>
                            <button
                                onClick={() => setError(null)}
                                className="ml-auto text-red-400 hover:text-red-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                )}

                {/* Test Logs Table */}
                <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Water Test Logs for {new Date(selectedDate).toLocaleDateString()}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-gray-500">Loading test logs...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-8 text-center">
                            <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">No test logs found</p>
                            <p className="text-gray-400">Try selecting a different date or clearing filters</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stage</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pH</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS (ppm)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EC (µS/cm)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Time</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Recorded By</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredLogs.map((log) => (
                                        <tr key={log.log_id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{log.stage_name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                                                    log.test_session === 'Morning' 
                                                        ? 'bg-yellow-100 text-yellow-800' 
                                                        : 'bg-orange-100 text-orange-800'
                                                }`}>
                                                    {log.test_session}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm ${getValueColor('ph_value', log.ph_value)}`}>
                                                    {log.ph_value || 'N/A'}
                                                    {isValueDangerous('ph_value', log.ph_value) && (
                                                        <AlertTriangle className="inline w-4 h-4 ml-1 text-red-500" />
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm ${getValueColor('tds_ppm_value', log.tds_ppm_value)}`}>
                                                    {log.tds_ppm_value || 'N/A'}
                                                    {isValueDangerous('tds_ppm_value', log.tds_ppm_value) && (
                                                        <AlertTriangle className="inline w-4 h-4 ml-1 text-red-500" />
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm ${getValueColor('ec_us_cm_value', log.ec_us_cm_value)}`}>
                                                    {log.ec_us_cm_value || 'N/A'}
                                                    {isValueDangerous('ec_us_cm_value', log.ec_us_cm_value) && (
                                                        <AlertTriangle className="inline w-4 h-4 ml-1 text-red-500" />
                                                    )}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(log.test_timestamp).toLocaleTimeString('en-US', { timeZone: 'UTC' })}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {log.recorded_by}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <WaterLogForm 
                    isOpen={showLogForm}
                    onClose={() => setShowLogForm(false)}
                    onSubmit={handleSubmitLogs}
                    formData={formData}
                    setFormData={setFormData}
                    stages={stages}
                    selectedDate={selectedDate}
                    setSelectedDate={setSelectedDate}
                    loading={loading}
                    dangerThresholds={dangerThresholds}
                />

            </div>
        </div>
    );
}