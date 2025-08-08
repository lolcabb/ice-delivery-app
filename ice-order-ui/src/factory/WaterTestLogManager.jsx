import React, { useState, useEffect, useCallback } from 'react';
import { Droplets, Plus, Calendar, AlertTriangle, X, BarChart3, Search, Filter } from 'lucide-react';
import { apiService } from '../apiService';
import { getISODate } from '../utils/dateUtils';
import { isROStage } from '../utils/stageUtils';

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
    const [initialLoad, setInitialLoad] = useState(true);
    
    // Filter states
    const [searchTerm, setSearchTerm] = useState('');
    const [stageFilter, setStageFilter] = useState('All');
    const [sessionFilter, setSessionFilter] = useState('All');

    // Form data for logging tests
    const [formData, setFormData] = useState({});

    const [hasExistingLogs, setHasExistingLogs] = useState(false);

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
        ec_us_cm_value: { min: 0, max: 1000, unit: 'µS/cm' },
        hardness_mg_l_caco3: { min: 50, max: 170, unit: 'mg/L CaCO₃' }
    };

    // Determine if a water treatment stage should be treated as RO
    // A stage is considered RO if its name contains "reverse osmosis",
    // is exactly "ro", or has a stage_id of 5
    // Uses the shared isROStage utility for consistency across components

    const fetchStages = useCallback(async () => {
        try {
            const data = await apiService.get('/water/stages');
            setStages(Array.isArray(data) ? data : []);
            
            // Initialize form data structure based on stages
            const initialFormData = {};
            data.forEach(stage => {
                initialFormData[stage.stage_id] = {
                    morning: { 
                        ph_value: '', 
                        tds_ppm_value: '', 
                        ec_us_cm_value: '',
                        hardness_mg_l_caco3: '' 
                    },
                    afternoon: { 
                        ph_value: '', 
                        tds_ppm_value: '', 
                        ec_us_cm_value: '',
                        hardness_mg_l_caco3: '' 
                    }
                };
            });
            setFormData(initialFormData);
        } catch (err) {
            console.error('Error fetching stages:', err);
            setError(err.response?.data?.message || 'ไม่สามารถโหลดข้อมูลขั้นตอนการตรวจสอบได้');
        }
    }, []);

    const fetchLogs = useCallback(async (date, showWarning = true) => {
        setLoading(true);
        setError(null);
        try {
            const data = await apiService.get(`/water/logs?date=${date}`);
            setLogs(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Error fetching water logs:', err);
            if (err.status === 404) {
                setLogs([]);
                if (showWarning) {
                    setError(err.response?.data?.message || 'ไม่มีบันทึกการตรวจสอบน้ำ');
                }
            } else {
                setError(err.response?.data?.message || 'ไม่สามารถโหลดบันทึกการตรวจสอบน้ำได้ กรุณาลองใหม่อีกครั้ง');
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
        const parameters = ['ph_value', 'tds_ppm_value', 'ec_us_cm_value', 'hardness_mg_l_caco3'];
        
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
        const parameters = ['ph_value', 'tds_ppm_value', 'ec_us_cm_value', 'hardness_mg_l_caco3'];

        // Group logs by stage and calendar date
        const grouped = {};
        logs.forEach(log => {
            const date = log.test_timestamp.split('T')[0];
            const key = `${log.stage_id}-${date}`;
            if (!grouped[key]) {
                grouped[key] = {};
                parameters.forEach(param => {
                    grouped[key][param] = [];
                });
            }
            parameters.forEach(param => {
                const value = Number(log[param]);
                if (log[param] !== null && log[param] !== '' && !isNaN(value)) {
                    grouped[key][param].push(value);
                }
            });
        });

        // Calculate per-day averages for each parameter
        const values = {};
        parameters.forEach(param => { values[param] = []; });
        Object.values(grouped).forEach(group => {
            parameters.forEach(param => {
                const arr = group[param];
                if (arr.length > 0) {
                    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
                    values[param].push(avg);
                }
            });
        });

        // Compute overall averages from per-day averages
        const averages = {};
        parameters.forEach(param => {
            const arr = values[param];
            averages[param] = arr.length > 0
                ? (arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(2)
                : 'N/A';
        });

        return averages;
    };

    useEffect(() => {
        fetchStages();
        fetchDashboardData();
    }, [fetchStages, fetchDashboardData]);

    useEffect(() => {
        fetchLogs(selectedDate, !initialLoad);
        setInitialLoad(false);
    }, [selectedDate, fetchLogs]);

    const resetForm = useCallback(() => {
        const reset = {};
        stages.forEach(stage => {
            reset[stage.stage_id] = {
                morning: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '', hardness_mg_l_caco3: '' },
                afternoon: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '', hardness_mg_l_caco3: '' }
            };
        });
        setFormData(reset);
    }, [stages]);
    
useEffect(() => {
    setHasExistingLogs(logs.length > 0);
}, [logs]);

useEffect(() => {
    if (showLogForm) {
        if (logs.length > 0) {
            const existingData = {};
            
            // Initialize all stages first
            stages.forEach(stage => {
                existingData[stage.stage_id] = {
                    morning: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '', hardness_mg_l_caco3: '' },
                    afternoon: { ph_value: '', tds_ppm_value: '', ec_us_cm_value: '', hardness_mg_l_caco3: '' }
                };
            });
            
            // Populate with existing log data (deduplicated by log_id)
            const processedLogs = new Set();
            logs.forEach(log => {
                // Skip if we've already processed this exact log
                if (processedLogs.has(log.log_id)) return;
                processedLogs.add(log.log_id);
                
                const sessionKey = log.test_session.toLowerCase();
                if (existingData[log.stage_id] && (sessionKey === 'morning' || sessionKey === 'afternoon')) {
                    existingData[log.stage_id][sessionKey] = {
                        ph_value: log.ph_value || '',
                        tds_ppm_value: log.tds_ppm_value || '',
                        ec_us_cm_value: log.ec_us_cm_value || '',
                        hardness_mg_l_caco3: log.hardness_mg_l_caco3 || ''
                    };
                }
            });
            
            setFormData(existingData);
        } else {
            resetForm();
        }
    } else {
        resetForm();
    }
}, [showLogForm, logs, stages, resetForm]);

    useEffect(() => {
        resetForm();
    }, [selectedDate, resetForm]);

    const handleSubmitLogs = async () => {
        if (loading) return; // Prevent double submission
    
        setLoading(true);
        try {
            const logsToUpsert = [];
            
            // Convert form data to individual log entries
            Object.keys(formData).forEach(stageId => {
                const stageData = formData[stageId];
                const stage = stages.find(s => s.stage_id === parseInt(stageId));
                const includeHardness = isROStage(stage);

                ['morning', 'afternoon'].forEach(session => {
                    const sessionData = stageData[session];
                    if (sessionData && (sessionData.ph_value || sessionData.tds_ppm_value || sessionData.ec_us_cm_value || (includeHardness && sessionData.hardness_mg_l_caco3))) {
                        const logEntry = {
                            stage_id: parseInt(stageId),
                            test_session: session.charAt(0).toUpperCase() + session.slice(1),
                            test_timestamp: new Date(`${selectedDate}T${session === 'morning' ? '08:00:00' : '14:00:00'}Z`).toISOString(),
                            ph_value: sessionData.ph_value === '' ? null : Number(sessionData.ph_value),
                            tds_ppm_value: sessionData.tds_ppm_value === '' ? null : Number(sessionData.tds_ppm_value),
                            ec_us_cm_value: sessionData.ec_us_cm_value === '' ? null : Number(sessionData.ec_us_cm_value)
                        };
                        if (includeHardness) {
                            logEntry.hardness_mg_l_caco3 = sessionData.hardness_mg_l_caco3 === '' ? null : Number(sessionData.hardness_mg_l_caco3);
                        }
                        logsToUpsert.push(logEntry);
                    }
                });
            });

        if (logsToUpsert.length === 0) {
            setError('กรุณากรอกข้อมูลการตรวจสอบอย่างน้อยหนึ่งรายการ');
            setLoading(false);
            return;
        }

        // Use new upsert endpoint
        await apiService.put('/water/logs/upsert', {
            date: selectedDate,
            logs: logsToUpsert
        });

        // Refresh data
        await Promise.all([
            fetchLogs(selectedDate),
            fetchDashboardData()
        ]);

        setShowLogForm(false);
        resetForm();
        setError(null);
        
    } catch (err) {
        console.error('Failed to update water test logs:', err);
        setError(err.response?.data?.message || 'ไม่สามารถบันทึกผลการตรวจสอบได้ กรุณาลองใหม่อีกครั้ง');
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
                                <h1 className="text-2xl font-bold text-gray-900">บันทึกการตรวจสอบคุณภาพน้ำ</h1>
                                <p className="text-gray-600">ติดตามคุณภาพน้ำในทุกขั้นตอนการบำบัด'</p>
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
                                แดชบอร์ด
                            </button>
                            <button
                                onClick={() => setShowLogForm(true)}
                                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <Plus className="w-5 h-5" />
                                เพิ่มผลการตรวจสอบ
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
                            <label className="text-sm font-medium text-gray-700">ผลวันที่:</label>
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
                                    placeholder="ค้นหาบันทึก..."
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
                                <option value="All">ขั้นตอนทั้งหมด</option>
                                {stages.map(stage => (
                                    <option key={stage.stage_id} value={stage.stage_name}>{stage.stage_name}</option>
                                ))}
                            </select>
                            <select
                                value={sessionFilter}
                                onChange={(e) => setSessionFilter(e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="All">ทุกช่วง</option>
                                <option value="Morning">เช้า</option>
                                <option value="Afternoon">บ่าย</option>
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
                            ผลตรวจสอบน้ำในวันที่ {new Date(selectedDate).toLocaleDateString()}
                        </h2>
                    </div>

                    {loading ? (
                        <div className="p-8 text-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-2 text-gray-500">กำลังโหลดบันทึกการตรวจสอบ...</p>
                        </div>
                    ) : filteredLogs.length === 0 ? (
                        <div className="p-8 text-center">
                            <Droplets className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-500 text-lg">ไม่พบบันทึกการตรวจสอบ</p>
                            <p className="text-gray-400">ลองเลือกวันที่อื่นหรือล้างตัวกรอง</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ขั้นตอน</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ช่วงเวลา</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ค่า pH</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS (ppm)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EC (µS/cm)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hardness (mg/L CaCO₃)</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เวลา</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">บันทึกโดย</th>
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
                                                    {log.test_session === 'Morning' ? 'เช้า' : 'บ่าย'}
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
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`text-sm ${getValueColor('hardness_mg_l_caco3', log.hardness_mg_l_caco3)}`}>
                                                    {log.hardness_mg_l_caco3 || 'N/A'}
                                                    {isValueDangerous('hardness_mg_l_caco3', log.hardness_mg_l_caco3) && (
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
                    hasExistingLogs={hasExistingLogs}
                />

            </div>
        </div>
    );
}
