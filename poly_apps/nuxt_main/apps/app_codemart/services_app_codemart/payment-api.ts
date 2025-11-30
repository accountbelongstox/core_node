/**
 * CodeMart Payment Management API Service
 * Handles payments, wallets, invoices, and refunds
 * Uses centralized type definitions from codemart-types.ts
 */

import { CodeMartApiBase, type PaginatedResponse, type PaginationParams } from './codemart-api-base';
import type { Payment, Wallet, WalletTransaction, Invoice, Refund } from '../types/codemart-types';
import { PaymentStatus, PaymentMethod, PaymentType } from '../types/codemart-enums';

export interface GetPaymentsRequest extends PaginationParams {
  status?: PaymentStatus;
  type?: PaymentType;
}

export interface CreatePaymentRequest {
  payee_id: number;
  project_id?: number;
  milestone_id?: number;
  amount: number;
  type: PaymentType;
  payment_method: PaymentMethod;
  description?: string;
}

export interface CreateInvoiceRequest {
  payment_id: number;
  description?: string;
  line_items?: Array<{ name: string; quantity: number; unit_price: number }>;
  tax?: number;
}

export interface RequestRefundRequest {
  payment_id: number;
  reason: string;
  notes?: string;
}

export class PaymentApi extends CodeMartApiBase {
  async getWallet(): Promise<Wallet> {
    const response = await this.get<Wallet>('/wallet');
    return response;
  }

  async getWalletTransactions(filters: PaginationParams = {}): Promise<PaginatedResponse<WalletTransaction>> {
    const query = this.buildQuery(filters, filters);
    const response = await this.get<PaginatedResponse<WalletTransaction>>('/wallet/transactions', query);
    return response;
  }

  async createPayment(data: CreatePaymentRequest): Promise<Payment> {
    const response = await this.post<Payment>('/payments', data);
    return response;
  }

  async getPayment(paymentId: number): Promise<Payment> {
    const response = await this.get<Payment>(`/payments/${paymentId}`);
    return response;
  }

  async getPayments(filters: GetPaymentsRequest = {}): Promise<PaginatedResponse<Payment>> {
    const query = this.buildQuery(filters, filters);
    const response = await this.get<PaginatedResponse<Payment>>('/payments', query);
    return response;
  }

  async createInvoice(data: CreateInvoiceRequest): Promise<Invoice> {
    const response = await this.post<Invoice>('/invoices', data);
    return response;
  }

  async requestRefund(data: RequestRefundRequest): Promise<Refund> {
    const response = await this.post<Refund>('/refunds/request', data);
    return response;
  }

  async approveRefund(refundId: number): Promise<Refund> {
    const response = await this.post<Refund>(`/refunds/${refundId}/approve`, {});
    return response;
  }

  async processRefund(refundId: number): Promise<Refund> {
    const response = await this.post<Refund>(`/refunds/${refundId}/process`, {});
    return response;
  }
}

export default new PaymentApi();
