export const isROStage = (stage) => {
  if (!stage) return false;
  const name = stage.stage_name?.toLowerCase() || '';
  return name.includes('reverse osmosis') || name === 'ro' || stage.stage_id === 5;
};
