export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      attendance: {
        Row: {
          class_id: string;
          created_at: string;
          date: string;
          day_of_week: number;
          id: string;
          note: string | null;
          recorded_by: string | null;
          semester: string;
          status: Database["public"]["Enums"]["attendance_status"];
          subject_code: string;
          student_id: string;
          week_number: number;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          date: string;
          day_of_week?: number;
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          semester?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          subject_code?: string;
          student_id: string;
          week_number?: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          date?: string;
          day_of_week?: number;
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          semester?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          subject_code?: string;
          student_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_attendance: {
        Row: {
          created_at: string;
          date: string;
          day_of_week: number;
          id: string;
          note: string | null;
          recorded_by: string | null;
          semester: string;
          status: Database["public"]["Enums"]["attendance_status"];
          subject_code: string;
          teacher_id: string;
          week_number: number;
        };
        Insert: {
          created_at?: string;
          date: string;
          day_of_week?: number;
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          semester?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          subject_code?: string;
          teacher_id: string;
          week_number?: number;
        };
        Update: {
          created_at?: string;
          date?: string;
          day_of_week?: number;
          id?: string;
          note?: string | null;
          recorded_by?: string | null;
          semester?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          subject_code?: string;
          teacher_id?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_attendance_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      certificates: {
        Row: {
          created_at: string;
          description: string | null;
          file_url: string | null;
          id: string;
          issue_date: string;
          issued_by: string | null;
          kind: Database["public"]["Enums"]["certificate_kind"];
          status: Database["public"]["Enums"]["certificate_status"];
          student_id: string;
          title: string;
          updated_at: string;
          verification_code: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          file_url?: string | null;
          id?: string;
          issue_date?: string;
          issued_by?: string | null;
          kind?: Database["public"]["Enums"]["certificate_kind"];
          status?: Database["public"]["Enums"]["certificate_status"];
          student_id: string;
          title: string;
          updated_at?: string;
          verification_code?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          file_url?: string | null;
          id?: string;
          issue_date?: string;
          issued_by?: string | null;
          kind?: Database["public"]["Enums"]["certificate_kind"];
          status?: Database["public"]["Enums"]["certificate_status"];
          student_id?: string;
          title?: string;
          updated_at?: string;
          verification_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "certificates_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      classes: {
        Row: {
          academic_year: string | null;
          capacity: number;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          room: string | null;
          semester: string | null;
          subject_code: string;
          teacher_id: string | null;
          updated_at: string;
        };
        Insert: {
          academic_year?: string | null;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          room?: string | null;
          semester?: string | null;
          subject_code: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Update: {
          academic_year?: string | null;
          capacity?: number;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          room?: string | null;
          semester?: string | null;
          subject_code?: string;
          teacher_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "classes_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      enrollments: {
        Row: {
          class_id: string;
          enrolled_at: string;
          id: string;
          student_id: string;
        };
        Insert: {
          class_id: string;
          enrolled_at?: string;
          id?: string;
          student_id: string;
        };
        Update: {
          class_id?: string;
          enrolled_at?: string;
          id?: string;
          student_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "enrollments_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "enrollments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      exams: {
        Row: {
          class_id: string;
          created_at: string;
          exam_date: string | null;
          exam_type: Database["public"]["Enums"]["exam_type"];
          id: string;
          max_score: number;
          name: string;
          updated_at: string;
          weight: number;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          exam_date?: string | null;
          exam_type?: Database["public"]["Enums"]["exam_type"];
          id?: string;
          max_score?: number;
          name: string;
          updated_at?: string;
          weight?: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          exam_date?: string | null;
          exam_type?: Database["public"]["Enums"]["exam_type"];
          id?: string;
          max_score?: number;
          name?: string;
          updated_at?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "exams_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          body: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          is_read: boolean;
          kind: Database["public"]["Enums"]["notification_kind"];
          target_user_id: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_read?: boolean;
          kind?: Database["public"]["Enums"]["notification_kind"];
          target_user_id?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          is_read?: boolean;
          kind?: Database["public"]["Enums"]["notification_kind"];
          target_user_id?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      payments: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          description: string | null;
          due_date: string | null;
          id: string;
          invoice_number: string;
          method: Database["public"]["Enums"]["payment_method"] | null;
          paid_date: string | null;
          status: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number: string;
          method?: Database["public"]["Enums"]["payment_method"] | null;
          paid_date?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          description?: string | null;
          due_date?: string | null;
          id?: string;
          invoice_number?: string;
          method?: Database["public"]["Enums"]["payment_method"] | null;
          paid_date?: string | null;
          status?: Database["public"]["Enums"]["payment_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string;
          id: string;
          major: string | null;
          phone: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          major?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string;
          id?: string;
          major?: string | null;
          phone?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      scores: {
        Row: {
          created_at: string;
          exam_id: string;
          id: string;
          remark: string | null;
          score: number | null;
          student_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          exam_id: string;
          id?: string;
          remark?: string | null;
          score?: number | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          exam_id?: string;
          id?: string;
          remark?: string | null;
          score?: number | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scores_exam_id_fkey";
            columns: ["exam_id"];
            isOneToOne: false;
            referencedRelation: "exams";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      subject_scores: {
        Row: {
          class_id: string;
          created_at: string;
          id: string;
          max_score: number;
          recorded_by: string | null;
          score: number | null;
          semester: string;
          student_id: string;
          subject_code: string;
          updated_at: string;
          week_number: number;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          id?: string;
          max_score?: number;
          recorded_by?: string | null;
          score?: number | null;
          semester?: string;
          student_id: string;
          subject_code?: string;
          updated_at?: string;
          week_number?: number;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          id?: string;
          max_score?: number;
          recorded_by?: string | null;
          score?: number | null;
          semester?: string;
          student_id?: string;
          subject_code?: string;
          updated_at?: string;
          week_number?: number;
        };
        Relationships: [
          {
            foreignKeyName: "subject_scores_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "subject_scores_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          address: string | null;
          avatar_url: string | null;
          class_name: string | null;
          created_at: string;
          date_of_birth: string | null;
          email: string | null;
          enrollment_year: number;
          full_name: string;
          full_name_en: string | null;
          full_name_km: string | null;
          gender: string | null;
          id: string;
          phone: string | null;
          shift: string | null;
          status: Database["public"]["Enums"]["student_status"];
          study_year: number | null;
          student_code: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          address?: string | null;
          avatar_url?: string | null;
          class_name?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          enrollment_year?: number;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          gender?: string | null;
          id?: string;
          phone?: string | null;
          shift?: string | null;
          status?: Database["public"]["Enums"]["student_status"];
          study_year?: number | null;
          student_code: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          address?: string | null;
          avatar_url?: string | null;
          class_name?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          email?: string | null;
          enrollment_year?: number;
          full_name?: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          gender?: string | null;
          id?: string;
          phone?: string | null;
          shift?: string | null;
          status?: Database["public"]["Enums"]["student_status"];
          study_year?: number | null;
          student_code?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      teachers: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          department: string | null;
          email: string | null;
          faculty: string | null;
          full_name: string;
          full_name_en: string | null;
          full_name_km: string | null;
          hire_date: string | null;
          id: string;
          phone: string | null;
          specialization: string | null;
          staff_code: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          faculty?: string | null;
          full_name: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          hire_date?: string | null;
          id?: string;
          phone?: string | null;
          specialization?: string | null;
          staff_code: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          department?: string | null;
          email?: string | null;
          faculty?: string | null;
          full_name?: string;
          full_name_en?: string | null;
          full_name_km?: string | null;
          hire_date?: string | null;
          id?: string;
          phone?: string | null;
          specialization?: string | null;
          staff_code?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      timetable_slots: {
        Row: {
          class_id: string;
          created_at: string;
          day: Database["public"]["Enums"]["weekday"];
          end_time: string;
          id: string;
          room: string | null;
          start_time: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          day: Database["public"]["Enums"]["weekday"];
          end_time: string;
          id?: string;
          room?: string | null;
          start_time: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          day?: Database["public"]["Enums"]["weekday"];
          end_time?: string;
          id?: string;
          room?: string | null;
          start_time?: string;
        };
        Relationships: [
          {
            foreignKeyName: "timetable_slots_class_id_fkey";
            columns: ["class_id"];
            isOneToOne: false;
            referencedRelation: "classes";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "teacher" | "student";
      attendance_status: "present" | "absent" | "late" | "excused";
      certificate_kind: "completion" | "graduation" | "award" | "participation";
      certificate_status: "draft" | "issued" | "revoked";
      exam_type: "quiz" | "midterm" | "final" | "assignment" | "project";
      notification_kind: "info" | "warning" | "success" | "announcement";
      payment_method: "cash" | "card" | "bank_transfer" | "mobile";
      payment_status: "pending" | "paid" | "overdue" | "cancelled";
      student_status: "active" | "inactive" | "graduated" | "suspended";
      weekday: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "teacher", "student"],
      attendance_status: ["present", "absent", "late", "excused"],
      certificate_kind: ["completion", "graduation", "award", "participation"],
      certificate_status: ["draft", "issued", "revoked"],
      exam_type: ["quiz", "midterm", "final", "assignment", "project"],
      notification_kind: ["info", "warning", "success", "announcement"],
      payment_method: ["cash", "card", "bank_transfer", "mobile"],
      payment_status: ["pending", "paid", "overdue", "cancelled"],
      student_status: ["active", "inactive", "graduated", "suspended"],
      weekday: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"],
    },
  },
} as const;
