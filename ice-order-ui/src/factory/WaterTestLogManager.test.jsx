import { evaluateDangerousValues, dangerThresholds } from './WaterTestLogManager';

describe('evaluateDangerousValues', () => {
  const baseLog = {
    stage_id: 1,
    stage_name: 'Stage 1',
    ph_value: null,
    tds_ppm_value: null,
    ec_us_cm_value: null,
    hardness_mg_l_caco3: null,
    recorded_by: 'tester'
  };

  test('resolved danger is cleared by later normal reading', () => {
    const logs = [
      { ...baseLog, log_id: 1, test_session: 'Morning', test_timestamp: '2024-01-01T08:00:00Z', tds_ppm_value: 600 },
      { ...baseLog, log_id: 2, test_session: 'Afternoon', test_timestamp: '2024-01-01T12:00:00Z', tds_ppm_value: 400 }
    ];

    const result = evaluateDangerousValues(logs, dangerThresholds);
    expect(result).toHaveLength(0);
  });

  test('unresolved danger remains with latest reading', () => {
    const logs = [
      { ...baseLog, log_id: 3, test_session: 'Morning', test_timestamp: '2024-01-02T08:00:00Z', tds_ppm_value: 600 },
      { ...baseLog, log_id: 4, test_session: 'Afternoon', test_timestamp: '2024-01-02T12:00:00Z', tds_ppm_value: 700 }
    ];

    const result = evaluateDangerousValues(logs, dangerThresholds);
    expect(result).toHaveLength(1);
    expect(result[0].stage_id).toBe(1);
    expect(result[0].parameter).toBe('tds_ppm_value');
    expect(result[0].value).toBe(700);
  });
});
