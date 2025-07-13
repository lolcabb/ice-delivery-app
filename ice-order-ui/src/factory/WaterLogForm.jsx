import React from 'react';
import { X, Droplets, AlertTriangle, Sun, Moon, Calendar, Save } from 'lucide-react';

const WaterLogForm = ({ 
    isOpen, 
    onClose, 
    onSubmit, 
    formData, 
    setFormData, 
    stages = [],
    selectedDate,
    setSelectedDate,
    loading = false,
    dangerThresholds
}) => {
    if (!isOpen) return null;

    const handleInputChange = (stageId, session, parameter, value) => {
        setFormData(prev => ({
            ...prev,
            [stageId]: {
                ...prev[stageId],
                [session]: {
                    ...prev[stageId]?.[session],
                    [parameter]: value
                }
            }
        }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        
        // Check if at least one field is filled
        let hasData = false;
        Object.keys(formData).forEach(stageId => {
            const stageData = formData[stageId];
            ['morning', 'afternoon'].forEach(session => {
                const sessionData = stageData[session];
                if (sessionData && (sessionData.ph_value || sessionData.tds_ppm_value || sessionData.ec_us_cm_value)) {
                    hasData = true;
                }
            });
        });

        if (!hasData) {
            alert('Please enter at least one test value before submitting');
            return;
        }

        onSubmit();
    };

    const isValueDangerous = (parameter, value) => {
        if (!value || !dangerThresholds?.[parameter]) return false;
        const threshold = dangerThresholds[parameter];
        const numValue = parseFloat(value);
        return numValue < threshold.min || numValue > threshold.max;
    };

    const getInputClassName = (parameter, value) => {
        const baseClass = "w-20 px-2 py-1 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-center";
        if (!value) return `${baseClass} border-gray-300`;
        
        return isValueDangerous(parameter, value) 
            ? `${baseClass} border-red-300 bg-red-50 text-red-900`
            : `${baseClass} border-green-300 bg-green-50`;
    };

    const getSessionIcon = (session) => {
        return session === 'morning' ? <Sun className="w-4 h-4 text-yellow-600" /> : <Moon className="w-4 h-4 text-blue-600" />;
    };

    const getSessionColor = (session) => {
        return session === 'morning' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800';
    };

    const getParameterUnit = (parameter) => {
        switch (parameter) {
            case 'ph_value': return 'pH';
            case 'tds_ppm_value': return 'ppm';
            case 'ec_us_cm_value': return 'µS/cm';
            default: return '';
        }
    };

    const getParameterThreshold = (parameter) => {
        if (!dangerThresholds?.[parameter]) return '';
        const threshold = dangerThresholds[parameter];
        return `(${threshold.min}-${threshold.max})`;
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-6xl w-full max-h-[95vh] overflow-y-auto">
                <div className="p-6">
                    {/* Header */}
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 rounded-lg">
                                <Droplets className="w-6 h-6 text-blue-600" />
                            </div>
                            <div>
                                <h2 className="text-xl font-semibold text-gray-900">Log Water Quality Tests</h2>
                                <p className="text-sm text-gray-600">Enter test values for all treatment stages</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Date Selection */}
                    <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-3">
                            <Calendar className="w-5 h-5 text-blue-600" />
                            <label className="text-sm font-medium text-blue-900">Test Date:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-3 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                max={new Date().toISOString().split('T')[0]}
                            />
                            <div className="ml-auto text-xs text-blue-700">
                                <strong>Note:</strong> Empty fields will be skipped during submission
                            </div>
                        </div>
                    </div>

                    {/* Safety Guidelines */}
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-medium text-yellow-900 mb-2">Safety Guidelines & Thresholds</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-yellow-800">
                                    <div>
                                        <strong>pH Level:</strong> {dangerThresholds?.ph_value?.min} - {dangerThresholds?.ph_value?.max}
                                        <div className="text-yellow-700">Optimal: 7.0 - 7.5</div>
                                    </div>
                                    <div>
                                        <strong>TDS:</strong> 0 - {dangerThresholds?.tds_ppm_value?.max} ppm
                                        <div className="text-yellow-700">Target: &lt; 50 ppm (RO output)</div>
                                    </div>
                                    <div>
                                        <strong>EC:</strong> 0 - {dangerThresholds?.ec_us_cm_value?.max} µS/cm
                                        <div className="text-yellow-700">Target: &lt; 100 µS/cm (RO output)</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Test Data Form */}
                    <div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full">
                                <thead>
                                    <tr className="bg-gray-50">
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border border-gray-200">
                                            Treatment Stage
                                        </th>
                                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border border-gray-200">
                                            Session
                                        </th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                            pH Level {getParameterThreshold('ph_value')}
                                        </th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                            TDS (ppm) {getParameterThreshold('tds_ppm_value')}
                                        </th>
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                            EC (µS/cm) {getParameterThreshold('ec_us_cm_value')}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {stages.map((stage) => (
                                        <React.Fragment key={stage.stage_id}>
                                            {['morning', 'afternoon'].map((session, sessionIndex) => (
                                                <tr key={`${stage.stage_id}-${session}`} className="hover:bg-gray-50">
                                                    {/* Stage Name (only show for first session) */}
                                                    <td className="px-4 py-3 border border-gray-200">
                                                        {sessionIndex === 0 ? (
                                                            <div className="font-medium text-gray-900">
                                                                {stage.stage_name}
                                                            </div>
                                                        ) : (
                                                            <div className="text-gray-400 text-sm ml-4">↳</div>
                                                        )}
                                                    </td>

                                                    {/* Session */}
                                                    <td className="px-4 py-3 border border-gray-200">
                                                        <div className="flex items-center gap-2">
                                                            {getSessionIcon(session)}
                                                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSessionColor(session)}`}>
                                                                {session.charAt(0).toUpperCase() + session.slice(1)}
                                                            </span>
                                                        </div>
                                                    </td>

                                                    {/* pH Value */}
                                                    <td className="px-4 py-3 border border-gray-200 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                min="0"
                                                                max="14"
                                                                value={formData[stage.stage_id]?.[session]?.ph_value || ''}
                                                                onChange={(e) => handleInputChange(stage.stage_id, session, 'ph_value', e.target.value)}
                                                                className={getInputClassName('ph_value', formData[stage.stage_id]?.[session]?.ph_value)}
                                                                placeholder="7.0"
                                                            />
                                                            {isValueDangerous('ph_value', formData[stage.stage_id]?.[session]?.ph_value) && (
                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* TDS Value */}
                                                    <td className="px-4 py-3 border border-gray-200 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={formData[stage.stage_id]?.[session]?.tds_ppm_value || ''}
                                                                onChange={(e) => handleInputChange(stage.stage_id, session, 'tds_ppm_value', e.target.value)}
                                                                className={getInputClassName('tds_ppm_value', formData[stage.stage_id]?.[session]?.tds_ppm_value)}
                                                                placeholder="50"
                                                            />
                                                            {isValueDangerous('tds_ppm_value', formData[stage.stage_id]?.[session]?.tds_ppm_value) && (
                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </td>

                                                    {/* EC Value */}
                                                    <td className="px-4 py-3 border border-gray-200 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                value={formData[stage.stage_id]?.[session]?.ec_us_cm_value || ''}
                                                                onChange={(e) => handleInputChange(stage.stage_id, session, 'ec_us_cm_value', e.target.value)}
                                                                className={getInputClassName('ec_us_cm_value', formData[stage.stage_id]?.[session]?.ec_us_cm_value)}
                                                                placeholder="100"
                                                            />
                                                            {isValueDangerous('ec_us_cm_value', formData[stage.stage_id]?.[session]?.ec_us_cm_value) && (
                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Buttons */}
                        <div className="flex gap-3 pt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                            >
                                <Save className="w-5 h-5" />
                                {loading ? 'Submitting...' : 'Submit All Tests'}
                            </button>
                        </div>

                    {/* Legend */}
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-50 border border-green-300 rounded"></div>
                                <span>Safe values</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-50 border border-red-300 rounded"></div>
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                <span>Dangerous values (outside safe range)</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Sun className="w-3 h-3 text-yellow-600" />
                                <span>Morning tests</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Moon className="w-3 h-3 text-blue-600" />
                                <span>Afternoon tests</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaterLogForm;