import React, { useState, useEffect, useCallback } from 'react';
import { apiService } from '../apiService';

// Helper to format date to YYYY-MM-DD for the API
const getFormattedDate = (date) => {
    return date.toISOString().split('T')[0];
};

const WaterTestLogManager = () => {
    const [logs, setLogs] = useState([]);
    const [stages, setStages] = useState([]);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({});

    const fetchLogs = useCallback(async (date) => {
        setLoading(true);
        setError(null);
        try {
            const formattedDate = getFormattedDate(date);
            const data = await apiService.get(`/water/logs?date=${formattedDate}`);
            setLogs(data);
        } catch (err) {
            console.error("Error fetching water logs:", err);
            setError('Failed to fetch water logs. Please try again.');
        } finally {
            setLoading(false);
        }
    }, []);

    const fetchStages = useCallback(async () => {
        try {
            const data = await apiService.get('/water/stages');
            setStages(data);
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
            console.error("Error fetching stages:", err);
            setError('Failed to fetch water test stages.');
        }
    }, []);

    useEffect(() => {
        fetchStages();
    }, [fetchStages]);

    useEffect(() => {
        if (stages.length > 0) {
            fetchLogs(selectedDate);
        }
    }, [selectedDate, stages, fetchLogs]);
    
    const handleDateChange = (e) => {
        setSelectedDate(new Date(e.target.value));
    };

    const handleInputChange = (stageId, session, field, value) => {
        setFormData(prev => ({
            ...prev,
            [stageId]: {
                ...prev[stageId],
                [session]: {
                    ...prev[stageId][session],
                    [field]: value
                }
            }
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const logsToSubmit = [];
        Object.keys(formData).forEach(stageId => {
            ['morning', 'afternoon'].forEach(session => {
                const sessionData = formData[stageId][session];
                if (sessionData.ph_value || sessionData.tds_ppm_value || sessionData.ec_us_cm_value) {
                    logsToSubmit.push({
                        stage_id: parseInt(stageId),
                        test_session: session.charAt(0).toUpperCase() + session.slice(1), // Capitalize session name
                        test_timestamp: selectedDate,
                        ...sessionData
                    });
                }
            });
        });

        try {
            // Using Promise.all to send all logs concurrently
            await Promise.all(logsToSubmit.map(log => apiService.post('/water/logs', log)));
            alert('Logs submitted successfully!');
            fetchLogs(selectedDate); // Refresh logs after submission
        } catch (err) {
            console.error("Error submitting logs:", err);
            setError('Failed to submit logs. Please check your entries and try again.');
        } finally {
            setLoading(false);
        }
    };
    
    // Function to find a log for a specific stage and session
    const findLog = (stageId, session) => {
        const sessionName = session.charAt(0).toUpperCase() + session.slice(1);
        return logs.find(log => log.stage_name === stages.find(s => s.stage_id === stageId)?.stage_name && log.test_session === sessionName);
    };

    return (
        <div className="p-6 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-3xl font-bold text-gray-800 mb-4">Water Quality Test Log</h1>
                <p className="text-gray-600 mb-6">Log daily test results for pH, TDS, and EC at each stage of the water purification process.</p>

                <div className="mb-6">
                    <label htmlFor="date-picker" className="block text-sm font-medium text-gray-700 mb-2">Select Date:</label>
                    <input
                        type="date"
                        id="date-picker"
                        value={getFormattedDate(selectedDate)}
                        onChange={handleDateChange}
                        className="p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4" role="alert">{error}</div>}

                <form onSubmit={handleSubmit}>
                    <div className="bg-white shadow-md rounded-lg overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Test Stage</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Session</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">pH</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">TDS (ppm)</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">EC (µS/cm)</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {stages.map((stage, stageIndex) => (
                                    <React.Fragment key={stage.stage_id}>
                                        {['morning', 'afternoon'].map((session, sessionIndex) => {
                                            const existingLog = findLog(stage.stage_id, session);
                                            const isSubmitted = !!existingLog;
                                            return (
                                                <tr key={`${stage.stage_id}-${session}`} className={isSubmitted ? "bg-green-50" : ""}>
                                                    {sessionIndex === 0 && (
                                                        <td rowSpan="2" className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border-b border-gray-200">{stage.stage_name}</td>
                                                    )}
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{session.charAt(0).toUpperCase() + session.slice(1)}</td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="number" step="0.01" disabled={isSubmitted} placeholder={isSubmitted ? existingLog.ph_value : "pH"} value={isSubmitted ? existingLog.ph_value : formData[stage.stage_id]?.[session]?.ph_value} onChange={(e) => handleInputChange(stage.stage_id, session, 'ph_value', e.target.value)} className="w-24 p-1 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="number" step="0.01" disabled={isSubmitted} placeholder={isSubmitted ? existingLog.tds_ppm_value : "TDS"} value={isSubmitted ? existingLog.tds_ppm_value : formData[stage.stage_id]?.[session]?.tds_ppm_value} onChange={(e) => handleInputChange(stage.stage_id, session, 'tds_ppm_value', e.target.value)} className="w-24 p-1 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <input type="number" step="0.01" disabled={isSubmitted} placeholder={isSubmitted ? existingLog.ec_us_cm_value : "EC"} value={isSubmitted ? existingLog.ec_us_cm_value : formData[stage.stage_id]?.[session]?.ec_us_cm_value} onChange={(e) => handleInputChange(stage.stage_id, session, 'ec_us_cm_value', e.target.value)} className="w-24 p-1 border border-gray-300 rounded-md disabled:bg-gray-100"/>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400"
                        >
                            {loading ? 'Submitting...' : 'Submit All Logs'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default WaterTestLogManager;
