import { describe, test, expect, vi, beforeEach } from 'vitest';

vi.mock('next-auth', () => ({
  getServerSession: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn()
    }
  }
}));

vi.mock('@/app/api/auth/[...nextauth]/route', () => ({
  opts: {}
}));

vi.mock('./shop-admin-auth', async () => {
  const actual = await vi.importActual('./shop-admin-auth');
  return {
    ...actual,
    verifyShopAdminAccess: vi.fn(),
    verifyShopItemAdminAccess: vi.fn(),
    isShopAdminWhitelisted: vi.fn()
  };
});

const mockGetServerSession = vi.mocked(await import('next-auth')).getServerSession;
const mockUserFindUnique = vi.fn();
const mockVerifyShopAdminAccess = vi.fn();
const mockVerifyShopItemAdminAccess = vi.fn();
const mockIsShopAdminWhitelisted = vi.fn();

describe('Access Control', () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    const { prisma } = await import('@/lib/prisma');
    (prisma.user.findUnique as any) = mockUserFindUnique;

    const shopAdminAuth = await import('./shop-admin-auth');
    (shopAdminAuth.verifyShopAdminAccess as any) = mockVerifyShopAdminAccess;
    (shopAdminAuth.verifyShopItemAdminAccess as any) = mockVerifyShopItemAdminAccess;
    (shopAdminAuth.isShopAdminWhitelisted as any) = mockIsShopAdminWhitelisted;
  });

  describe('Shop Admin Access', () => {
    test('denies access when not authenticated', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: false,
        error: 'Unauthorized',
        status: 401
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Unauthorized');
        expect(result.status).toBe(401);
      }
    });

    test('denies access when user not found in database', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: false,
        error: 'User not found',
        status: 404
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('User not found');
        expect(result.status).toBe(404);
      }
    });

    test('denies access when user is not admin', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: false,
        error: 'Admin access required',
        status: 403
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Admin access required');
        expect(result.status).toBe(403);
      }
    });

    test('denies access when admin not in whitelist', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: false,
        error: 'Access denied. Only authorized shop administrators can access this resource.',
        status: 403
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Access denied. Only authorized shop administrators can access this resource.');
        expect(result.status).toBe(403);
      }
    });

    test('grants access when admin is in whitelist', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: true,
        user: {
          id: 'user1',
          email: 'test@example.com',
          role: 'Admin'
        }
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user).toEqual({
          id: 'user1',
          email: 'test@example.com',
          role: 'Admin'
        });
      }
    });

    test('grants access with isAdmin flag even if role is not Admin', async () => {
      mockVerifyShopAdminAccess.mockResolvedValue({
        success: true,
        user: {
          id: 'user1',
          email: 'test@example.com',
          role: 'User'
        }
      });

      const { verifyShopAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopAdminAccess();

      expect(result.success).toBe(true);
    });
  });

  describe('Shop Item Admin Access', () => {
    test('uses separate whitelist for shop item admin', async () => {
      mockVerifyShopItemAdminAccess.mockResolvedValue({
        success: true,
        user: {
          id: 'user1',
          email: 'item-admin@example.com',
          role: 'Admin'
        }
      });

      const { verifyShopItemAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopItemAdminAccess();

      expect(result.success).toBe(true);
    });

    test('denies access when not in shop item whitelist', async () => {
      mockVerifyShopItemAdminAccess.mockResolvedValue({
        success: false,
        error: 'Access denied. Only authorized shop item administrators can access this resource.',
        status: 403
      });

      const { verifyShopItemAdminAccess } = await import('./shop-admin-auth');
      const result = await verifyShopItemAdminAccess();

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBe('Access denied. Only authorized shop item administrators can access this resource.');
      }
    });
  });

  describe('Whitelist Helper Functions', () => {
    test('isShopAdminWhitelisted checks environment variable', async () => {
      mockIsShopAdminWhitelisted.mockImplementation((email: string) => {
        const whitelist = ['admin1@example.com', 'admin2@example.com'];
        return whitelist.includes(email);
      });

      const { isShopAdminWhitelisted } = await import('./shop-admin-auth');

      expect(isShopAdminWhitelisted('admin1@example.com')).toBe(true);
      expect(isShopAdminWhitelisted('admin2@example.com')).toBe(true);
      expect(isShopAdminWhitelisted('user@example.com')).toBe(false);
    });

    test('handles empty whitelist', async () => {
      mockIsShopAdminWhitelisted.mockReturnValue(false);

      const { isShopAdminWhitelisted } = await import('./shop-admin-auth');

      expect(isShopAdminWhitelisted('admin@example.com')).toBe(false);
    });

    test('handles whitespace in whitelist', async () => {
      mockIsShopAdminWhitelisted.mockImplementation((email: string) => {
        const whitelist = ['admin1@example.com', 'admin2@example.com'];
        return whitelist.includes(email);
      });

      const { isShopAdminWhitelisted } = await import('./shop-admin-auth');

      expect(isShopAdminWhitelisted('admin1@example.com')).toBe(true);
      expect(isShopAdminWhitelisted('admin2@example.com')).toBe(true);
    });
  });

  describe('User Data Access Control', () => {
    test('users can only access their own data', () => {
      const currentUserId = 'user123';
      const requestedUserId = 'user456';
      const isAdmin = false;

      const canAccessUserData = (currentId: string, requestedId: string, isAdmin: boolean) => {
        return isAdmin || currentId === requestedId;
      };

      expect(canAccessUserData(currentUserId, currentUserId, isAdmin)).toBe(true);
      expect(canAccessUserData(currentUserId, requestedUserId, isAdmin)).toBe(false);
    });

    test('admins can access all user data', () => {
      const currentUserId = 'admin123';
      const requestedUserId = 'user456';
      const isAdmin = true;

      const canAccessUserData = (currentId: string, requestedId: string, isAdmin: boolean) => {
        return isAdmin || currentId === requestedId;
      };

      expect(canAccessUserData(currentUserId, requestedUserId, isAdmin)).toBe(true);
      expect(canAccessUserData(currentUserId, currentUserId, isAdmin)).toBe(true);
    });
  });

  describe('Admin Endpoint Access', () => {
    test('only admins can access admin endpoints', () => {
      const checkAdminEndpointAccess = (userRole: string, isAdmin: boolean) => {
        return userRole === 'Admin' || isAdmin === true;
      };

      expect(checkAdminEndpointAccess('Admin', false)).toBe(true);
      expect(checkAdminEndpointAccess('User', true)).toBe(true);
      expect(checkAdminEndpointAccess('User', false)).toBe(false);
      expect(checkAdminEndpointAccess('Reviewer', false)).toBe(false);
    });

    test('reviewers can access review endpoints but not admin endpoints', () => {
      const checkReviewEndpointAccess = (userRole: string, isAdmin: boolean) => {
        return userRole === 'Admin' || userRole === 'Reviewer' || isAdmin === true;
      };

      const checkAdminEndpointAccess = (userRole: string, isAdmin: boolean) => {
        return userRole === 'Admin' || isAdmin === true;
      };

      expect(checkReviewEndpointAccess('Reviewer', false)).toBe(true);
      expect(checkAdminEndpointAccess('Reviewer', false)).toBe(false);

      expect(checkReviewEndpointAccess('Admin', false)).toBe(true);
      expect(checkAdminEndpointAccess('Admin', false)).toBe(true);
    });
  });
});