import React from 'react';
import { X, Droplets, AlertTriangle, Sun, Moon, Calendar, Save } from 'lucide-react';
import { getISODate } from '../utils/dateUtils';
import { isROStage } from '../utils/stageUtils';

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
    dangerThresholds,
    hasExistingLogs = false
}) => {
    if (!isOpen) return null;

    // Determine whether any stage is RO to conditionally show hardness input
    const showHardness = stages.some(isROStage);

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

    const handleSubmit = () => {
        // Check if at least one field is filled
        let hasData = false;
        Object.keys(formData).forEach(stageId => {
            const stageData = formData[stageId];
            ['morning', 'afternoon'].forEach(session => {
                const sessionData = stageData[session];
                if (sessionData && (sessionData.ph_value || sessionData.tds_ppm_value || sessionData.ec_us_cm_value || sessionData.hardness_mg_l_caco3)) {
                    hasData = true;
                }
            });
        });

        if (!hasData) {
            alert('กรุณากรอกค่าอย่างน้อยหนึ่งค่าก่อนบันทึก');
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

    const getParameterThreshold = (parameter) => {
    if (!dangerThresholds?.[parameter]) return null;
    
    const threshold = dangerThresholds[parameter];
    
    switch(parameter) {
        case 'ph_value':
            return `ค่าปลอดภัย: ${threshold.min} - ${threshold.max} ${threshold.unit}`;
        case 'tds_ppm_value':
            return `ค่าปลอดภัย: 0 - ${threshold.max} ${threshold.unit}`;
        case 'ec_us_cm_value':
            return `ค่าปลอดภัย: 0 - ${threshold.max} ${threshold.unit}`;
        case 'hardness_mg_l_caco3':
            return `ค่าปลอดภัย: ${threshold.min} - ${threshold.max} ${threshold.unit}`;
        default:
            return `ค่าปลอดภัย: ${threshold.min} - ${threshold.max} ${threshold.unit}`;
    }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
                <div className="flex flex-col h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-200">
                        <div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                {hasExistingLogs ? 'แก้ไขผลการตรวจสอบคุณภาพน้ำ' : 'เพิ่มผลการตรวจสอบคุณภาพน้ำ'}
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                วันที่: {new Date(selectedDate).toLocaleDateString('th-TH')}
                                {hasExistingLogs && <span className="text-blue-600 ml-2">• มีข้อมูลเดิมอยู่แล้ว</span>}
                            </p>
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
                            <label className="text-sm font-medium text-blue-900">วันที่ตรวจสอบ:</label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-3 py-1 border border-blue-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                max={getISODate(new Date())}
                            />
                            <div className="ml-auto text-xs text-blue-700">
                                <strong>หมายเหตุ:</strong> กรอกค่าที่วัดได้จากการตรวจสอบคุณภาพน้ำในแต่ละขั้นตอน สามารถกรอกเฉพาะช่วงเวลาที่ต้องการได้
                            </div>
                        </div>
                    </div>

                    {/* Safety Guidelines */}
                    <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                            <div>
                                <h3 className="text-sm font-medium text-yellow-900 mb-2">ช่วงค่ามาตรฐาน</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-yellow-800">
                                    <div>
                                        <strong>pH Level:</strong> {dangerThresholds?.ph_value?.min} - {dangerThresholds?.ph_value?.max}
                                        <div className="text-yellow-700">ค่าเหมาะสม: 6.5 - 8.5</div>
                                    </div>
                                    <div>
                                        <strong>TDS:</strong> 0 - {dangerThresholds?.tds_ppm_value?.max} ppm
                                        <div className="text-yellow-700">ค่าเหมาะสม: &lt; 50 ppm (หลัง RO)</div>
                                    </div>
                                    <div>
                                        <strong>EC:</strong> 0 - {dangerThresholds?.ec_us_cm_value?.max} µS/cm
                                        <div className="text-yellow-700">ค่าเหมาะสม: &lt; 100 µS/cm (หลัง RO)</div>
                                    </div>
                                    <div>
                                        <strong>Hardness:</strong> {dangerThresholds?.hardness_mg_l_caco3?.min} - {dangerThresholds?.hardness_mg_l_caco3?.max} mg/L CaCO₃
                                        <div className="text-yellow-700">ค่าเหมาะสม: &lt; 60-120 mg/L CaCO₃</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Test Data Table */}
                    <div className="overflow-x-auto mb-6">
                        <table className="min-w-full">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border border-gray-200">
                                        ขั้นตอนการกรองน้ำ
                                    </th>
                                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 border border-gray-200">
                                        ช่วงทดสอบ
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                        ค่า pH {getParameterThreshold('ph_value')}
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                        TDS (ppm) {getParameterThreshold('tds_ppm_value')}
                                    </th>
                                    <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                        EC (µS/cm) {getParameterThreshold('ec_us_cm_value')}
                                    </th>
                                    {showHardness && (
                                        <th className="px-4 py-3 text-center text-sm font-medium text-gray-700 border border-gray-200">
                                            Hardness (mg/L CaCO₃) {getParameterThreshold('hardness_mg_l_caco3')}
                                        </th>
                                    )}
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

                                                {/* Hardness Value */}
                                                { isROStage(stage) && (
                                                    <td className="px-4 py-3 border border-gray-200 text-center">
                                                        <div className="flex items-center justify-center gap-1">
                                                            <input
                                                                type="number"
                                                                step="1"
                                                                min="0"
                                                                max="500"
                                                                value={formData[stage.stage_id]?.[session]?.hardness_mg_l_caco3 || ''}
                                                                onChange={(e) => handleInputChange(stage.stage_id, session, 'hardness_mg_l_caco3', e.target.value)}
                                                                className={getInputClassName('hardness_mg_l_caco3', formData[stage.stage_id]?.[session]?.hardness_mg_l_caco3)}
                                                                placeholder="120"
                                                            />
                                                            {isValueDangerous('hardness_mg_l_caco3', formData[stage.stage_id]?.[session]?.hardness_mg_l_caco3) && (
                                                                <AlertTriangle className="w-4 h-4 text-red-500" />
                                                            )}
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Legend */}
                    <div className="mb-6 p-3 bg-gray-50 rounded-lg">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-green-50 border border-green-300 rounded"></div>
                                <span>ช่วงปลอดภัย</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <div className="w-3 h-3 bg-red-50 border border-red-300 rounded"></div>
                                <AlertTriangle className="w-3 h-3 text-red-500" />
                                <span>ค่าอันตราย</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Sun className="w-3 h-3 text-yellow-600" />
                                <span>ตรวจน้ำช่วงเช้า</span>
                            </div>
                            <div className="flex items-center gap-1">
                                <Moon className="w-3 h-3 text-blue-600" />
                                <span>ตรวจน้ำช่วงบ่าย</span>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={loading}
                                className={`flex-1 flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
                                    loading 
                                        ? 'bg-gray-400 text-gray-600 cursor-not-allowed' 
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                                        {hasExistingLogs ? 'กำลังอัปเดต...' : 'กำลังบันทึก...'}
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {hasExistingLogs ? 'อัปเดตผลการตรวจสอบ' : 'บันทึกผลการตรวจสอบ'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaterLogForm;
