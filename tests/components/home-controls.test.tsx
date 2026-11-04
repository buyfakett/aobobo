import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, rs } from '@rstest/core';
import { GlobeControls, SortSelect, StatusFilter } from '@/components/react/HomeControls';

describe('server list controls', () => {
  it('selects an online status and closes when clicking outside', () => {
    const onChange = rs.fn();
    const { rerender } = render(<StatusFilter value="" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '全部' }));
    fireEvent.pointerDown(screen.getByRole('button', { name: '在线' }));
    expect(screen.getByRole('button', { name: '离线' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '在线' }));
    expect(onChange).toHaveBeenCalledWith('1');
    expect(screen.queryByRole('button', { name: '离线' })).toBeNull();
    rerender(<StatusFilter value="1" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: '在线' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: '全部' })).toBeNull();
    rerender(<StatusFilter value="invalid" onChange={onChange} />);
    expect(screen.getByRole('button', { name: '全部' })).toBeTruthy();
  });

  it('toggles sort direction independently, selects fields and resets the selected field', () => {
    const options = [{ value: 'Name', label: '名称' }, { value: 'CPU', label: 'CPU 使用率' }];
    const onChange = rs.fn();
    const { rerender } = render(<SortSelect value={{ prop: 'Name', order: 'desc' }} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByTitle('切换升序/降序'));
    expect(onChange).toHaveBeenLastCalledWith({ prop: 'Name', order: 'asc' });
    expect(screen.queryByRole('button', { name: 'CPU 使用率' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '名称' }));
    fireEvent.click(screen.getByRole('button', { name: 'CPU 使用率' }));
    expect(onChange).toHaveBeenLastCalledWith({ prop: 'CPU', order: 'desc' });
    rerender(<SortSelect value={{ prop: 'CPU', order: 'asc' }} options={options} onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'CPU 使用率' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'CPU 使用率' })[1]);
    expect(onChange).toHaveBeenLastCalledWith({ prop: 'DisplayIndex', order: 'asc' });
    fireEvent.click(screen.getByTitle('切换升序/降序'));
    expect(onChange).toHaveBeenLastCalledWith({ prop: 'CPU', order: 'desc' });
    fireEvent.click(screen.getByRole('button', { name: 'CPU 使用率' }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('button', { name: '名称' })).toBeNull();
    rerender(<SortSelect value={{ prop: 'unknown', order: 'asc' }} options={options} onChange={onChange} />);
    expect(screen.getByRole('button', { name: '排序' })).toBeTruthy();
  });
});

describe('globe controls', () => {
  it('changes rotation, speed and connection preferences and disables speed while paused', () => {
    const onAutoRotate = rs.fn(); const onSpeed = rs.fn(); const onConnections = rs.fn();
    const callbacks = { onAutoRotate, onSpeed, onConnections };
    const { rerender } = render(<GlobeControls autoRotate speed={0.5} connections {...callbacks} />);
    fireEvent.click(screen.getByRole('button', { name: '自转中' }));
    expect(onAutoRotate).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByRole('slider'), { target: { value: '1.2' } });
    expect(onSpeed.mock.calls[0][0]).toBeCloseTo(1.2);
    fireEvent.click(screen.getByRole('button', { name: '连线' }));
    expect(onConnections).toHaveBeenCalledWith(false);
    rerender(<GlobeControls autoRotate={false} speed={1.2} connections={false} {...callbacks} />);
    expect((screen.getByRole('slider') as HTMLInputElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: '已暂停' }));
    expect(onAutoRotate).toHaveBeenLastCalledWith(true);
    fireEvent.click(screen.getByRole('button', { name: '连线' }));
    expect(onConnections).toHaveBeenLastCalledWith(true);
  });
});
