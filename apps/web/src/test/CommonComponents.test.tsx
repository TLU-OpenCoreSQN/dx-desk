// SPDX-FileCopyrightText: 2026 TLU-OpenCoreSQN
// SPDX-License-Identifier: Apache-2.0

import React, { createRef } from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Button } from '../components/common/Button';
import { Modal } from '../components/common/Modal';
import {
  Skeleton,
  SkeletonText,
  SkeletonCard,
  SkeletonTable,
  SkeletonPage,
} from '../components/common/Skeleton';
import { ToastProvider, useToast } from '../contexts/ToastContext';

describe('Common UI Primitives - Button', () => {
  it('renders button with text and default attributes', () => {
    render(<Button>Xác nhận</Button>);
    const button = screen.getByRole('button', { name: 'Xác nhận' });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('type', 'button');
    expect(button).not.toBeDisabled();
    // Default md size has mobile 44px min height
    expect(button.className).toContain('min-h-[44px]');
    expect(button.className).toContain('lg:min-h-10');
  });

  it('renders all variants with proper color and outline classes', () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    let btn = screen.getByRole('button', { name: 'Primary' });
    expect(btn.className).toContain('bg-primary');
    expect(btn.className).not.toContain('bg-gradient');

    rerender(<Button variant="secondary">Secondary</Button>);
    btn = screen.getByRole('button', { name: 'Secondary' });
    expect(btn.className).toContain('border-[var(--color-edge-subtle)]');

    rerender(<Button variant="success">Success</Button>);
    btn = screen.getByRole('button', { name: 'Success' });
    expect(btn.className).toContain('bg-[var(--color-success)]');

    rerender(<Button variant="danger">Danger</Button>);
    btn = screen.getByRole('button', { name: 'Danger' });
    expect(btn.className).toContain('bg-[var(--color-danger)]');

    rerender(<Button variant="ghost">Ghost</Button>);
    btn = screen.getByRole('button', { name: 'Ghost' });
    expect(btn.className).toContain('bg-transparent');

    rerender(<Button variant="outline">Outline</Button>);
    btn = screen.getByRole('button', { name: 'Outline' });
    expect(btn.className).toContain('border-[var(--color-edge)]');
  });

  it('renders all sizes with mobile touch target minimum (44px)', () => {
    const { rerender } = render(<Button size="sm">Small</Button>);
    let btn = screen.getByRole('button', { name: 'Small' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('lg:min-h-8');

    rerender(<Button size="md">Medium</Button>);
    btn = screen.getByRole('button', { name: 'Medium' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('lg:min-h-10');

    rerender(<Button size="lg">Large</Button>);
    btn = screen.getByRole('button', { name: 'Large' });
    expect(btn.className).toContain('min-h-[44px]');
    expect(btn.className).toContain('lg:min-h-11');
  });

  it('handles click events and respects disabled state', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();

    const { rerender } = render(<Button onClick={handleClick}>Clickable</Button>);
    await user.click(screen.getByRole('button', { name: 'Clickable' }));
    expect(handleClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button disabled onClick={handleClick}>
        Disabled
      </Button>
    );
    const disabledBtn = screen.getByRole('button', { name: 'Disabled' });
    expect(disabledBtn).toBeDisabled();
    await user.click(disabledBtn);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders loading state with spinner and disables button', () => {
    render(<Button isLoading>Đang gửi...</Button>);
    const button = screen.getByRole('button', { name: 'Đang gửi...' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = screen.getByTestId('button-spinner');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass('animate-spin');
  });

  it('renders icon, leftIcon, and rightIcon slots', () => {
    const { rerender } = render(
      <Button leftIcon={<span data-testid="left-icon">L</span>}>Icon Button</Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();

    rerender(
      <Button
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
      >
        Both Icons
      </Button>
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();

    // In loading state, spinner replaces lead icon and right icon is hidden
    rerender(
      <Button
        isLoading
        leftIcon={<span data-testid="left-icon">L</span>}
        rightIcon={<span data-testid="right-icon">R</span>}
      >
        Loading Button
      </Button>
    );
    expect(screen.queryByTestId('left-icon')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right-icon')).not.toBeInTheDocument();
    expect(screen.getByTestId('button-spinner')).toBeInTheDocument();
  });

  it('forwards ref correctly to the underlying HTML button element', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Ref Button</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});

describe('Common UI Primitives - Modal', () => {
  it('does not render when isOpen is false', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <div>Modal Content</div>
      </Modal>
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText('Modal Content')).not.toBeInTheDocument();
  });

  it('renders dialog when isOpen is true with accessibility attributes', () => {
    render(
      <Modal
        isOpen={true}
        onClose={vi.fn()}
        title="Tiêu đề hộp thoại"
        description="Mô tả chi tiết nội dung hộp thoại"
      >
        <div>Nội dung trong modal</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('Tiêu đề hộp thoại')).toBeInTheDocument();
    expect(screen.getByText('Mô tả chi tiết nội dung hộp thoại')).toBeInTheDocument();
    expect(screen.getByText('Nội dung trong modal')).toBeInTheDocument();
  });

  it('locks body scroll when opened and restores on unmount', () => {
    const originalOverflow = document.body.style.overflow;
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <div>Scroll Locked</div>
      </Modal>
    );

    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe(originalOverflow);
  });

  it('calls onClose when close button is clicked', async () => {
    const handleClose = vi.fn();
    const user = userEvent.setup();

    render(
      <Modal isOpen={true} onClose={handleClose} title="Hộp thoại">
        <div>Nội dung</div>
      </Modal>
    );

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    await user.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking backdrop overlay', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Nội dung bên trong</div>
      </Modal>
    );

    const backdrop = screen.getByTestId('modal-backdrop');
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose when clicking modal content', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Nội dung bên trong</div>
      </Modal>
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.click(dialog);
    expect(handleClose).not.toHaveBeenCalled();
  });

  it('calls onClose when pressing Escape key', () => {
    const handleClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={handleClose}>
        <div>Nội dung</div>
      </Modal>
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('traps Tab focus inside the modal dialog', async () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Focus Trap Modal">
        <button type="button">Action 1</button>
        <button type="button">Action 2</button>
      </Modal>
    );

    const closeBtn = screen.getByRole('button', { name: 'Đóng' });
    const action1 = screen.getByRole('button', { name: 'Action 1' });
    const action2 = screen.getByRole('button', { name: 'Action 2' });

    // Focus close button, tab to action1
    closeBtn.focus();
    expect(document.activeElement).toBe(closeBtn);
    fireEvent.keyDown(document, { key: 'Tab' });

    // Focus last element (Action 2) and press Tab -> should wrap around to first element (Close button)
    action2.focus();
    expect(document.activeElement).toBe(action2);
    expect(action1).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeBtn);

    // Focus first element (Close button) and press Shift+Tab -> should wrap around to last element (Action 2)
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(action2);
  });
});

describe('Common UI Primitives - Skeleton', () => {
  it('renders base Skeleton with status role and dimensions', () => {
    render(<Skeleton width={120} height={24} circle />);
    const skeleton = screen.getByRole('status', { name: 'Đang tải dữ liệu...' });
    expect(skeleton).toBeInTheDocument();
    expect(skeleton.className).toContain('animate-pulse');
    expect(skeleton.className).toContain('rounded-full');
    expect(skeleton).toHaveStyle({ width: '120px', height: '24px' });
  });

  it('renders SkeletonText with configured lines', () => {
    const { container } = render(<SkeletonText lines={4} lastLineWidth="50%" />);
    const status = screen.getByRole('status', { name: 'Đang tải đoạn văn bản...' });
    expect(status).toBeInTheDocument();
    const skeletonBars = container.querySelectorAll('.animate-pulse');
    expect(skeletonBars.length).toBe(4);
    expect(skeletonBars[3]).toHaveStyle({ width: '50%' });
  });

  it('renders SkeletonCard matching dx-card structure', () => {
    render(<SkeletonCard hasHeader={true} hasFooter={true} bodyLines={3} />);
    const card = screen.getByRole('status', { name: 'Đang tải thẻ nội dung...' });
    expect(card).toBeInTheDocument();
    expect(card.className).toContain('dx-card');
  });

  it('renders SkeletonTable with specified rows and columns', () => {
    const { container } = render(<SkeletonTable rows={4} columns={3} showHeader={true} />);
    const table = screen.getByRole('status', { name: 'Đang tải bảng dữ liệu...' });
    expect(table).toBeInTheDocument();

    // 1 header row with 3 items + 4 body rows with 3 items = 15 pulse items
    const cells = container.querySelectorAll('.animate-pulse');
    expect(cells.length).toBe(15);
  });

  it('renders SkeletonPage for route Suspense fallback', () => {
    render(<SkeletonPage />);
    const page = screen.getByRole('status', { name: 'Đang tải trang...' });
    expect(page).toBeInTheDocument();
  });
});

class TestErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <div>Caught: {(this.state.error as Error).message}</div>;
    }
    return this.props.children;
  }
}

describe('Common UI Primitives - Toast and ToastContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws an error if useToast is used outside of ToastProvider', () => {
    function InvalidConsumer() {
      useToast();
      return null;
    }
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const handleError = (e: ErrorEvent) => {
      e.preventDefault();
    };
    window.addEventListener('error', handleError);

    render(
      <TestErrorBoundary>
        <InvalidConsumer />
      </TestErrorBoundary>
    );

    expect(screen.getByText(/useToast must be used within a ToastProvider/)).toBeInTheDocument();
    window.removeEventListener('error', handleError);
    consoleSpy.mockRestore();
  });

  it('shows and displays success, error, warning, info toasts', () => {
    function TestComponent() {
      const { showToast } = useToast();
      return (
        <div>
          <button
            onClick={() =>
              showToast({
                type: 'success',
                title: 'Thành công',
                message: 'Thao tác hoàn tất',
                duration: 5000,
              })
            }
          >
            Show Success
          </button>
          <button
            onClick={() =>
              showToast({
                type: 'error',
                title: 'Lỗi',
                message: 'Không thể kết nối',
                duration: 5000,
              })
            }
          >
            Show Error
          </button>
        </div>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    // Initial state: no toasts
    expect(screen.queryByTestId('toast-container')).not.toBeInTheDocument();

    // Trigger success toast
    fireEvent.click(screen.getByRole('button', { name: 'Show Success' }));
    expect(screen.getByText('Thành công')).toBeInTheDocument();
    expect(screen.getByText('Thao tác hoàn tất')).toBeInTheDocument();
    const successToast = screen.getByRole('status');
    expect(successToast).toHaveAttribute('aria-live', 'polite');

    // Trigger error toast
    fireEvent.click(screen.getByRole('button', { name: 'Show Error' }));
    expect(screen.getByText('Lỗi')).toBeInTheDocument();
    expect(screen.getByText('Không thể kết nối')).toBeInTheDocument();
    const errorToast = screen.getByRole('alert');
    expect(errorToast).toHaveAttribute('aria-live', 'assertive');
  });

  it('dismisses toast when close button is clicked', () => {
    function TestComponent() {
      const { showToast } = useToast();
      return (
        <button
          onClick={() =>
            showToast({
              type: 'info',
              message: 'Thông báo cần đóng',
              duration: 10000,
            })
          }
        >
          Show Info
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Info' }));
    expect(screen.getByText('Thông báo cần đóng')).toBeInTheDocument();

    const closeBtn = screen.getByRole('button', { name: 'Đóng thông báo' });
    fireEvent.click(closeBtn);
    expect(screen.queryByText('Thông báo cần đóng')).not.toBeInTheDocument();
  });

  it('auto-dismisses toast after duration elapsed', () => {
    function TestComponent() {
      const { showToast } = useToast();
      return (
        <button
          onClick={() =>
            showToast({
              type: 'warning',
              message: 'Cảnh báo tự biến mất',
              duration: 3000,
            })
          }
        >
          Show Warning
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Warning' }));
    expect(screen.getByText('Cảnh báo tự biến mất')).toBeInTheDocument();

    // Advance timer by 2999ms -> still there
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(screen.getByText('Cảnh báo tự biến mất')).toBeInTheDocument();

    // Advance 1ms more -> dismissed
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByText('Cảnh báo tự biến mất')).not.toBeInTheDocument();
  });

  it('pauses auto-dismiss timer on mouseEnter and resumes on mouseLeave', () => {
    function TestComponent() {
      const { showToast } = useToast();
      return (
        <button
          onClick={() =>
            showToast({
              type: 'info',
              message: 'Thông báo tạm dừng khi di chuột',
              duration: 3000,
            })
          }
        >
          Show Hoverable
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show Hoverable' }));
    const toastElement = screen.getByRole('status');
    expect(screen.getByText('Thông báo tạm dừng khi di chuột')).toBeInTheDocument();

    // Advance 1000ms
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    // Hover mouse (pause)
    fireEvent.mouseEnter(toastElement);

    // Advance another 5000ms while hovered -> should NOT dismiss
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.getByText('Thông báo tạm dừng khi di chuột')).toBeInTheDocument();

    // Leave mouse (resume) -> should have ~2000ms left
    fireEvent.mouseLeave(toastElement);

    // Advance 1500ms -> still there
    act(() => {
      vi.advanceTimersByTime(1500);
    });
    expect(screen.getByText('Thông báo tạm dừng khi di chuột')).toBeInTheDocument();

    // Advance remaining 600ms -> dismissed
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText('Thông báo tạm dừng khi di chuột')).not.toBeInTheDocument();
  });
});
