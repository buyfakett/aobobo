import { describe, expect, it, rstest } from '@rstest/core';
import { StrictMode } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import App from '@/App';
import store from '@/store';
import wsInit from '@/ws';

rstest.mock('@/store', () => ({ default: { dispatch: rstest.fn() } }));
rstest.mock('@/ws', () => ({ default: rstest.fn() }));
rstest.mock('@/views/Home', () => ({ default: () => <div>Home page</div> }));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}

function mount(path, strict = false) {
  const app = <MemoryRouter initialEntries={[path]}><App /><Location /></MemoryRouter>;
  return render(strict ? <StrictMode>{app}</StrictMode> : app);
}

describe('application boot and routes', () => {
  it('retries failed initialization, boots once under StrictMode, and resolves all supported routes', async () => {
    rstest.spyOn(console, 'error').mockImplementation(() => {});
    rstest.mocked(store.dispatch).mockImplementation((action) => {
      if (action === 'initServerInfo') return Promise.reject(new Error('offline'));
    });
    let view = mount('/');
    await screen.findByText('Home page');
    await waitFor(() => expect(console.error).toHaveBeenCalledWith('Failed to initialize application:', expect.any(Error)));
    expect(wsInit).not.toHaveBeenCalled();
    view.unmount();

    rstest.mocked(store.dispatch).mockResolvedValue(undefined);
    view = mount('/server/42', true);
    await screen.findByText('Home page');
    await waitFor(() => expect(wsInit).toHaveBeenCalledTimes(1));
    expect(store.dispatch).toHaveBeenCalledTimes(4);
    expect(screen.getByTestId('location').textContent).toBe('/server/42');
    view.unmount();

    view = mount('/missing');
    await screen.findByText('Home page');
    expect(screen.getByTestId('location').textContent).toBe('/');
    expect(wsInit).toHaveBeenCalledTimes(1);
    expect(store.dispatch).toHaveBeenCalledTimes(4);
    view.unmount();
  });
});
