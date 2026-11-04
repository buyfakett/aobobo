import { beforeEach, describe, expect, it, rstest } from '@rstest/core';
import axios from 'axios';
import request from '../src/utils/request';

rstest.mock('axios', () => ({ default: rstest.fn() }));

describe('request queue', () => {
  const send = rstest.mocked(axios);
  beforeEach(() => { send.mockReset(); });

  it('maps the legacy type to method without mutating the caller', async () => {
    const response = { status: 200, data: 'ok' };
    send.mockResolvedValue(response);
    const config = { url: '/api', type: 'GET' as const };
    expect(await request(config)).toBe(response);
    expect(send).toHaveBeenCalledWith({ url: '/api', method: 'GET' });
    expect(config).toEqual({ url: '/api', type: 'GET' });
    await request({ url: '/api', method: 'POST', type: 'GET' });
    expect(send).toHaveBeenLastCalledWith({ url: '/api', method: 'POST' });
  });

  it('limits in-flight requests to ten and drains in FIFO order after success or failure', async () => {
    const pending: { resolve: (_value: any) => void; reject: (_reason: Error) => void }[] = [];
    send.mockImplementation(() => new Promise((resolve, reject) => pending.push({ resolve, reject })));
    const requests = Array.from({ length: 13 }, (_, id) => request({ url: `/${id}` }));
    const settled = Promise.allSettled(requests);
    expect(send).toHaveBeenCalledTimes(10);
    pending[0].resolve({ status: 200, data: 0 });
    await requests[0];
    expect(send).toHaveBeenCalledTimes(11);
    expect(send).toHaveBeenLastCalledWith({ url: '/10' });
    pending[1].reject(new Error('network'));
    await expect(requests[1]).rejects.toThrow('network');
    expect(send).toHaveBeenCalledTimes(12);
    expect(send).toHaveBeenLastCalledWith({ url: '/11' });
    pending[2].resolve({ status: 200, data: 2 });
    await requests[2];
    expect(send).toHaveBeenCalledTimes(13);
    pending.slice(3).forEach(({ resolve }, index) => resolve({ status: 200, data: index + 3 }));
    const results = await settled;
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(12);
    expect(results.filter(({ status }) => status === 'rejected')).toHaveLength(1);
  });
});
