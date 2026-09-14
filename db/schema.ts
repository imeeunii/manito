import { sql } from "drizzle-orm";
import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const classes = sqliteTable("classes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  studentCount: integer("student_count").notNull(),
  excludedNumbers: text("excluded_numbers").notNull().default("[]"),
  assignments: text("assignments").notNull(),
  customMissions: text("custom_missions").notNull().default("{}"),
  teacherPinHash: text("teacher_pin_hash").notNull(),
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const studentEntries = sqliteTable(
  "student_entries",
  {
    classId: integer("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    studentNumber: integer("student_number").notNull(),
    viewedAt: text("viewed_at"),
    letter: text("letter").notNull().default(""),
    strengthOne: text("strength_one").notNull().default(""),
    strengthTwo: text("strength_two").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [primaryKey({ columns: [table.classId, table.studentNumber] })]
);
