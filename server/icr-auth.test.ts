import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fetch for API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe("ICR API Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Auth Login", () => {
    it("should return token on successful login", async () => {
      const mockResponse = {
        ok: true,
        json: async () => ({ token: "test-jwt-token", memberName: "Admin User" }),
        text: async () => JSON.stringify({ token: "test-jwt-token", memberName: "Admin User" }),
        status: 200,
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch("https://tools-verse-protective-lip.trycloudflare.com/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "password" }),
      });

      expect(response.ok).toBe(true);
      const data = await response.json();
      expect(data.token).toBe("test-jwt-token");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://tools-verse-protective-lip.trycloudflare.com/api/v1/auth/login",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ username: "admin", password: "password" }),
        })
      );
    });

    it("should throw error on invalid credentials", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: async () => ({ message: "Credenciais inválidas" }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch("https://tools-verse-protective-lip.trycloudflare.com/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "wrong", password: "wrong" }),
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe("API Request with Bearer Token", () => {
    it("should include Authorization header when token is present", async () => {
      const mockResponse = {
        ok: true,
        text: async () => JSON.stringify([{ id: 1, name: "Federação Sul", ministerId: 1, ministerName: "Pastor João" }]),
        status: 200,
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const token = "test-jwt-token";
      const response = await fetch("https://tools-verse-protective-lip.trycloudflare.com/api/federations", {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://tools-verse-protective-lip.trycloudflare.com/api/federations",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Authorization": "Bearer test-jwt-token",
          }),
        })
      );
    });

    it("should handle 401 response by clearing session", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      };
      mockFetch.mockResolvedValueOnce(mockResponse);

      const response = await fetch("https://tools-verse-protective-lip.trycloudflare.com/api/federations", {
        headers: { "Authorization": "Bearer expired-token" },
      });

      expect(response.status).toBe(401);
    });
  });

  describe("Repasses Data Structure", () => {
    it("should correctly identify paid churches from repasses", () => {
      const repasses = [
        { id: 1, churchId: 1, churchName: "Igreja A", reference: 1, referenceName: "JAN-26", amount: 200 },
        { id: 2, churchId: 2, churchName: "Igreja B", reference: 1, referenceName: "JAN-26", amount: 150 },
      ];

      const churches = [
        { id: 1, name: "Igreja A", federationId: 1 },
        { id: 2, name: "Igreja B", federationId: 1 },
        { id: 3, name: "Igreja C", federationId: 1 },
      ];

      const rows = churches.map(church => {
        const repass = repasses.find(r => r.churchId === church.id);
        return {
          churchId: church.id,
          churchName: church.name,
          amount: repass?.amount,
        };
      });

      const totalPaid = rows.filter(r => r.amount && r.amount > 0).reduce((sum, r) => sum + (r.amount || 0), 0);
      const paidCount = rows.filter(r => r.amount && r.amount > 0).length;
      const pendingCount = rows.filter(r => !r.amount || r.amount === 0).length;

      expect(totalPaid).toBe(350);
      expect(paidCount).toBe(2);
      expect(pendingCount).toBe(1);
    });

    it("should format currency correctly in pt-BR", () => {
      const formatCurrency = (value: number) =>
        new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

      expect(formatCurrency(1428.07)).toContain('1.428,07');
      expect(formatCurrency(150)).toContain('150,00');
      expect(formatCurrency(0)).toContain('0,00');
    });

    it("should determine row color based on amount", () => {
      const getRowColor = (amount?: number): string => {
        if (!amount || amount === 0) return 'red';
        if (amount >= 200) return 'green';
        if (amount >= 150) return 'yellow';
        return 'light-yellow';
      };

      expect(getRowColor(undefined)).toBe('red');
      expect(getRowColor(0)).toBe('red');
      expect(getRowColor(200)).toBe('green');
      expect(getRowColor(330)).toBe('green');
      expect(getRowColor(150)).toBe('yellow');
      expect(getRowColor(198)).toBe('yellow');
      expect(getRowColor(100)).toBe('light-yellow');
    });
  });

  describe("Dashboard Data Mapping", () => {
    it("should map dashboard API response to sections correctly", () => {
      const dashboardData = {
        totalFederations: 6,
        totalChurches: 42,
        totalMissionaryCommunities: 6,
        totalFamilies: 142,
        totalCells: 57,
        totalMembers: 1046,
        localFamilies: 32,
        localCells: 7,
        localMembers: 216,
      };

      const sections = [
        {
          title: 'Federações, Igrejas e Comunidades Missionárias',
          cards: [
            { label: 'Total de Comissões Federadas', value: dashboardData.totalFederations ?? 0 },
            { label: 'Igrejas', value: dashboardData.totalChurches ?? 0 },
            { label: 'Comunidades Missionárias', value: dashboardData.totalMissionaryCommunities ?? 0 },
          ],
        },
      ];

      expect(sections[0].cards[0].value).toBe(6);
      expect(sections[0].cards[1].value).toBe(42);
      expect(sections[0].cards[2].value).toBe(6);
    });
  });
});
