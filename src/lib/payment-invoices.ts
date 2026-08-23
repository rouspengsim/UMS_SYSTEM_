import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PAYMENT_ROW_SELECT =
  "id,invoice_number,amount,due_date,paid_date,status,method,description,students(full_name,full_name_en,full_name_km,student_code,class_name,major,student_type,phone,date_of_birth,gender,address,enrollment_year,study_year)";

type CreatePaymentInvoiceInput = {
  accessToken: string;
  studentId: string;
  invoiceNumber: string;
  amount: number;
  dueDate?: string | null;
  description?: string | null;
};

type MarkPaymentPaidInput = {
  accessToken: string;
  paymentId: string;
  method?: "cash" | "mobile" | null;
};

function requireString(value: unknown, field: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${field} is required.`);
  }
  return value.trim();
}

function cleanOptional(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export const createPaymentInvoice = createServerFn({ method: "POST" })
  .inputValidator((input: CreatePaymentInvoiceInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Session");
    const studentId = requireString(data.studentId, "Student");
    const invoiceNumber = requireString(data.invoiceNumber, "Invoice number");
    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      throw new Error("Your session expired. Please log in again.");
    }

    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id,user_id")
      .eq("id", studentId)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("Student was not found.");

    const isOwnStudent = student.user_id === authData.user.id;
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;

    if (!isOwnStudent && !adminRole) {
      throw new Error("Only admins can create invoices for another student.");
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .insert({
        student_id: studentId,
        invoice_number: invoiceNumber,
        amount,
        due_date: cleanOptional(data.dueDate),
        description: cleanOptional(data.description),
        status: "pending",
      })
      .select(PAYMENT_ROW_SELECT)
      .single();
    if (paymentError) throw paymentError;

    return payment;
  });

export const markPaymentPaid = createServerFn({ method: "POST" })
  .inputValidator((input: MarkPaymentPaidInput) => input)
  .handler(async ({ data }) => {
    const accessToken = requireString(data.accessToken, "Session");
    const paymentId = requireString(data.paymentId, "Payment");

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !authData.user) {
      throw new Error("Your session expired. Please log in again.");
    }

    const { data: payment, error: paymentError } = await supabaseAdmin
      .from("payments")
      .select("id,student_id")
      .eq("id", paymentId)
      .maybeSingle();
    if (paymentError) throw paymentError;
    if (!payment) throw new Error("Payment was not found.");

    const { data: student, error: studentError } = await supabaseAdmin
      .from("students")
      .select("id,user_id")
      .eq("id", payment.student_id)
      .maybeSingle();
    if (studentError) throw studentError;
    if (!student) throw new Error("Student was not found.");

    const isOwnStudent = student.user_id === authData.user.id;
    const { data: adminRole, error: roleError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", authData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (roleError) throw roleError;

    if (!isOwnStudent && !adminRole) {
      throw new Error("Only admins can mark another student's payment paid.");
    }

    const { data: paidPayment, error: updateError } = await supabaseAdmin
      .from("payments")
      .update({
        status: "paid",
        method: data.method ?? "mobile",
        paid_date: new Date().toISOString().slice(0, 10),
      })
      .eq("id", paymentId)
      .select(PAYMENT_ROW_SELECT)
      .single();
    if (updateError) throw updateError;

    return paidPayment;
  });
