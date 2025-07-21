import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ItemTypeList from '../inventory/ItemTypeList.jsx';

test('shows empty message when no item types', () => {
  render(<ItemTypeList itemTypes={[]} isLoading={false} onEdit={jest.fn()} onDelete={jest.fn()} />);
  expect(screen.getByText(/ไม่พบประเภทวัสดุในคลัง/)).toBeInTheDocument();
});

test('calls edit and delete handlers', () => {
  const itemTypes = [{ item_type_id: 1, type_name: 'Box', description: '' }];
  const onEdit = jest.fn();
  const onDelete = jest.fn();
  render(<ItemTypeList itemTypes={itemTypes} isLoading={false} onEdit={onEdit} onDelete={onDelete} />);
  fireEvent.click(screen.getByTitle('แก้ไขประเภทวัสดุ'));
  expect(onEdit).toHaveBeenCalledWith(itemTypes[0]);
  fireEvent.click(screen.getByTitle('ลบประเภทวัสดุ'));
  expect(onDelete).toHaveBeenCalledWith(1);
});
