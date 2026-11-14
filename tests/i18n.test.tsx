import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, rs } from '@rstest/core';
import dayjs from 'dayjs';
import i18n, { getInitialLanguage, LANGUAGE_STORAGE_KEY } from '@/i18n';
import { CurrentTime, DashboardButton, LanguageSwitch } from '@/components/react/Common';
import { duration } from '@/utils/date';

describe('language preferences', () => {
  it('detects the browser language and prioritizes a supported saved choice', () => {
    localStorage.clear();
    rs.spyOn(navigator, 'language', 'get').mockReturnValue('zh-TW');
    expect(getInitialLanguage()).toBe('zh-CN');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
    expect(getInitialLanguage()).toBe('en');
    localStorage.setItem(LANGUAGE_STORAGE_KEY, 'unsupported');
    expect(getInitialLanguage()).toBe('zh-CN');
    rs.spyOn(navigator, 'language', 'get').mockReturnValue('fr-FR');
    expect(getInitialLanguage()).toBe('en');
  });

  it('switches visible content immediately and restores the selection after remounting', async () => {
    const { unmount } = render(<><LanguageSwitch /><DashboardButton /><CurrentTime /></>);
    fireEvent.click(screen.getByRole('button', { name: '语言' }));
    expect(screen.getByRole('menuitemradio', { name: '简体中文' }).getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(screen.getByLabelText('Current time')).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
    expect(getInitialLanguage()).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(dayjs.locale()).toBe('en');
    expect(duration(0, 3661000)).toBe('1h 1m');

    unmount();
    await i18n.changeLanguage(getInitialLanguage());
    render(<><LanguageSwitch /><DashboardButton /></>);
    fireEvent.click(screen.getByRole('button', { name: 'Language' }));
    expect(screen.getByRole('menuitemradio', { name: 'English' }).getAttribute('aria-checked')).toBe('true');
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: '简体中文' }));
    });
    expect(screen.getByRole('link', { name: '登录' })).toBeTruthy();
    expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('zh-CN');
    expect(document.documentElement.lang).toBe('zh-CN');
    expect(dayjs.locale()).toBe('zh-cn');
  });

  it('opens a custom menu, navigates options with the keyboard and restores focus on Escape', () => {
    const { container } = render(<LanguageSwitch />);
    const trigger = screen.getByRole('button', { name: '语言' });
    expect(container.querySelector('select')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(trigger);
    expect(screen.getByRole('menu', { name: '语言' })).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    const english = screen.getByRole('menuitemradio', { name: 'English' });
    const chinese = screen.getByRole('menuitemradio', { name: '简体中文' });
    act(() => chinese.focus());
    fireEvent.keyDown(chinese, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(english);
    fireEvent.keyDown(english, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(chinese);
    fireEvent.keyDown(chinese, { key: 'Home' });
    expect(document.activeElement).toBe(english);
    fireEvent.keyDown(english, { key: 'End' });
    expect(document.activeElement).toBe(chinese);
    fireEvent.keyDown(chinese, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('closes when toggled or clicking outside and leaves the language unchanged', () => {
    render(<><LanguageSwitch /><button>Outside</button></>);
    const trigger = screen.getByRole('button', { name: '语言' });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole('menu')).toBeNull();
    fireEvent.click(trigger);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
    expect(screen.queryByRole('menu')).toBeNull();
    expect(i18n.resolvedLanguage).toBe('zh-CN');
  });

  it('keeps switching languages when localStorage is blocked', async () => {
    rs.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    rs.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new Error('Storage blocked'); });
    expect(getInitialLanguage()).toBe('en');
    render(<><LanguageSwitch /><DashboardButton /></>);
    fireEvent.click(screen.getByRole('button', { name: '语言' }));
    await act(async () => {
      fireEvent.click(screen.getByRole('menuitemradio', { name: 'English' }));
    });
    expect(screen.getByRole('link', { name: 'Log in' })).toBeTruthy();
    expect(document.documentElement.lang).toBe('en');
  });
});
