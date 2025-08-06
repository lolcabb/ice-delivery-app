import React from 'react';
import { AlertTriangle, TrendingUp, TrendingDown, Activity, CheckCircle, Droplets, BarChart3 } from 'lucide-react';

const WaterDashboard = ({ 
    dashboardData, 
    dangerThresholds, 
    isVisible = true 
}) => {
    if (!isVisible) return null;

    const getTrendIcon = (trend) => {
        switch (trend) {
            case 'up': return <TrendingUp className="w-4 h-4 text-red-500" />;
            case 'down': return <TrendingDown className="w-4 h-4 text-green-500" />;
            default: return <Activity className="w-4 h-4 text-blue-500" />;
        }
    };

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'high': return 'bg-red-100 text-red-800 border-red-200';
            case 'medium': return 'bg-orange-100 text-orange-800 border-orange-200';
            default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
        }
    };

    const getSeverityText = (severity) => {
        switch (severity) {
            case 'high': return 'ความเสี่ยงสูง';
            case 'medium': return 'ความเสี่ยงปานกลาง';
            default: return 'ความเสี่ยงต่ำ';
        }
    };

    const formatParameterName = (parameter) => {
        switch (parameter) {
            case 'ph_value': return 'pH Level';
            case 'tds_ppm_value': return 'TDS';
            case 'ec_us_cm_value': return 'EC';
            case 'hardness_mg_l_caco3': return 'Water Hardness';
            default: return parameter.replace('_', ' ').toUpperCase();
        }
    };

    const translateSession = (session) => {
        return session === 'Morning' ? 'ช่วงเช้า' : 'ช่วงบ่าย';
    };

    return (
        <div className="mb-6">
            {/* Danger Alerts Section */}
            {dashboardData.dangerousValues && dashboardData.dangerousValues.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
                    <div className="flex items-center gap-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <h2 className="text-lg font-semibold text-red-800">
                            🚨 การแจ้งเตือนคุณภาพน้ำ ({dashboardData.dangerousValues.length})
                        </h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {dashboardData.dangerousValues.slice(0, 6).map((alert, idx) => (
                            <div key={idx} className="bg-white rounded-lg p-4 border border-red-200 shadow-sm">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <p className="font-medium text-gray-900">{alert.stage_name}</p>
                                        <p className="text-sm text-gray-600">{translateSession(alert.test_session)}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSeverityColor(alert.severity)}`}>
                                        {getSeverityText(alert.severity)}
                                    </span>
                                </div>
                                
                                <div className="space-y-1">
                                    <p className="text-sm text-red-700">
                                        <strong>{formatParameterName(alert.parameter)}:</strong> 
                                        <span className="ml-1 font-semibold">{alert.value}</span> {alert.threshold.unit}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        ช่วงปลอดภัย: {alert.threshold.min} - {alert.threshold.max} {alert.threshold.unit}
                                    </p>
                                    <p className="text-xs text-gray-400">
                                        {new Date(alert.test_timestamp).toLocaleDateString()} • {new Date(alert.test_timestamp).toLocaleTimeString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    {dashboardData.dangerousValues.length > 6 && (
                        <div className="mt-4 text-center">
                            <p className="text-sm text-red-600">
                                +{dashboardData.dangerousValues.length - 6} การแจ้งเตือน. 
                                <span className="font-medium"> โปรดติดตามการตรวจสอบค่าน้ำ</span>
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* Statistics Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
                {/* pH Level Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">ค่า pH (เฉลี่ย 7 วัน)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {dashboardData.averages?.ph_value || 'N/A'}
                                </p>
                                {dashboardData.averages?.ph_value && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        parseFloat(dashboardData.averages.ph_value) >= dangerThresholds.ph_value.min && 
                                        parseFloat(dashboardData.averages.ph_value) <= dangerThresholds.ph_value.max
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {parseFloat(dashboardData.averages.ph_value) >= dangerThresholds.ph_value.min && 
                                         parseFloat(dashboardData.averages.ph_value) <= dangerThresholds.ph_value.max
                                            ? 'Safe' 
                                            : 'Alert'
                                        }
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                ช่วงปลอดภัย: {dangerThresholds.ph_value.min} - {dangerThresholds.ph_value.max}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {getTrendIcon(dashboardData.trends?.ph_value)}
                            <div className="p-3 bg-blue-100 rounded-lg">
                                <Droplets className="w-6 h-6 text-blue-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* TDS Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">TDS (เฉลี่ย 7 วัน)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {dashboardData.averages?.tds_ppm_value || 'N/A'}
                                    {dashboardData.averages?.tds_ppm_value && <span className="text-sm text-gray-500 ml-1">ppm</span>}
                                </p>
                                {dashboardData.averages?.tds_ppm_value && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        parseFloat(dashboardData.averages.tds_ppm_value) <= dangerThresholds.tds_ppm_value.max
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {parseFloat(dashboardData.averages.tds_ppm_value) <= dangerThresholds.tds_ppm_value.max ? 'Safe' : 'Alert'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                ช่วงปลอดภัย: 0 - {dangerThresholds.tds_ppm_value.max} ppm
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {getTrendIcon(dashboardData.trends?.tds_ppm_value)}
                            <div className="p-3 bg-green-100 rounded-lg">
                                <Activity className="w-6 h-6 text-green-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* EC Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">EC (เฉลี่ย 7 วัน)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {dashboardData.averages?.ec_us_cm_value || 'N/A'}
                                    {dashboardData.averages?.ec_us_cm_value && <span className="text-sm text-gray-500 ml-1">µS/cm</span>}
                                </p>
                                {dashboardData.averages?.ec_us_cm_value && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        parseFloat(dashboardData.averages.ec_us_cm_value) <= dangerThresholds.ec_us_cm_value.max
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {parseFloat(dashboardData.averages.ec_us_cm_value) <= dangerThresholds.ec_us_cm_value.max ? 'Safe' : 'Alert'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                ช่วงปลอดภัย: 0 - {dangerThresholds.ec_us_cm_value.max} µS/cm
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {getTrendIcon(dashboardData.trends?.ec_us_cm_value)}
                            <div className="p-3 bg-purple-100 rounded-lg">
                                <BarChart3 className="w-6 h-6 text-purple-600" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Hardness Card */}
                <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-gray-600">Hardness (เฉลี่ย 7 วัน)</p>
                            <div className="flex items-center gap-2 mt-1">
                                <p className="text-2xl font-semibold text-gray-900">
                                    {dashboardData.averages?.hardness_mg_l_caco3 || 'N/A'}
                                    {dashboardData.averages?.hardness_mg_l_caco3 && <span className="text-sm text-gray-500 ml-1">mg/L</span>}
                                </p>
                                {dashboardData.averages?.hardness_mg_l_caco3 && (
                                    <span className={`text-xs px-2 py-1 rounded-full ${
                                        parseFloat(dashboardData.averages.hardness_mg_l_caco3) >= dangerThresholds.hardness_mg_l_caco3.min &&
                                        parseFloat(dashboardData.averages.hardness_mg_l_caco3) <= dangerThresholds.hardness_mg_l_caco3.max
                                            ? 'bg-green-100 text-green-800' 
                                            : 'bg-red-100 text-red-800'
                                    }`}>
                                        {parseFloat(dashboardData.averages.hardness_mg_l_caco3) >= dangerThresholds.hardness_mg_l_caco3.min &&
                                         parseFloat(dashboardData.averages.hardness_mg_l_caco3) <= dangerThresholds.hardness_mg_l_caco3.max
                                            ? 'Safe' 
                                            : 'Alert'
                                        }
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                ช่วงปลอดภัย: {dangerThresholds.hardness_mg_l_caco3?.min} - {dangerThresholds.hardness_mg_l_caco3?.max} mg/L CaCO₃
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            {getTrendIcon(dashboardData.trends?.hardness_mg_l_caco3)}
                            <div className="p-3 bg-orange-100 rounded-lg">
                                <Activity className="w-6 h-6 text-orange-600" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Quick Status Summary */}
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                            <span className="text-sm text-gray-700">
                                การตรวจสอบล่าสุด: {dashboardData.recentLogs?.length || 0}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-red-600" />
                            <span className="text-sm text-gray-700">
                                การแจ้งเตือน: {dashboardData.dangerousValues?.length || 0}
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-gray-500">
                        อัปเดตล่าสุด: {new Date().toLocaleTimeString()}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WaterDashboard;