import { PrismaClient } from "@prisma/client"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import bcrypt from "bcryptjs"
import path from "path"

const dbPath = path.join(process.cwd(), "dev.db")
const adapter = new PrismaLibSql({ url: `file://${dbPath}` })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding database…")

  // Create admin
  const adminHash = await bcrypt.hash("admin123", 12)
  const admin = await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      email: "admin@example.com",
      name: "Admin",
      hashedPassword: adminHash,
      role: "admin",
      languages: JSON.stringify([]),
    },
  })

  // Create reviewers
  const jaHash = await bcrypt.hash("reviewer123", 12)
  const jaReviewer = await prisma.user.upsert({
    where: { email: "keiko@example.com" },
    update: {},
    create: {
      email: "keiko@example.com",
      name: "Keiko Tanaka",
      hashedPassword: jaHash,
      role: "reviewer",
      languages: JSON.stringify(["ja-JP", "ja"]),
    },
  })

  await prisma.user.upsert({
    where: { email: "wei@example.com" },
    update: {},
    create: {
      email: "wei@example.com",
      name: "Wei Chen",
      hashedPassword: await bcrypt.hash("reviewer123", 12),
      role: "reviewer",
      languages: JSON.stringify(["zh-CN", "zh"]),
    },
  })

  // Create requester
  await prisma.user.upsert({
    where: { email: "requester@example.com" },
    update: {},
    create: {
      email: "requester@example.com",
      name: "Product Team",
      hashedPassword: await bcrypt.hash("requester123", 12),
      role: "requester",
      languages: JSON.stringify([]),
    },
  })

  // Create a sample project with XLIFF content
  const sampleXliff = `<?xml version="1.0" encoding="UTF-8"?>
<xliff version="1.2" xmlns="urn:oasis:names:tc:xliff:document:1.2">
  <file source-language="en-US" target-language="ja-JP" original="sample.md" datatype="plaintext">
    <body>
      <trans-unit id="welcome_title">
        <source>Welcome to our platform</source>
        <target>私たちのプラットフォームへようこそ</target>
      </trans-unit>
      <trans-unit id="signup_button">
        <source>Sign up for free</source>
        <target>無料で登録する</target>
      </trans-unit>
      <trans-unit id="login_prompt">
        <source>Already have an account? Log in</source>
        <target>すでにアカウントをお持ちですか？ログイン</target>
      </trans-unit>
      <trans-unit id="feature_1_title">
        <source>Fast and reliable</source>
        <target>速くて信頼性が高い</target>
      </trans-unit>
      <trans-unit id="feature_1_desc">
        <source>Our platform processes requests in milliseconds so you never wait.</source>
        <target>私たちのプラットフォームはミリ秒でリクエストを処理するので、待つことはありません。</target>
      </trans-unit>
      <trans-unit id="feature_2_title">
        <source>Secure by default</source>
        <target>デフォルトで安全</target>
      </trans-unit>
      <trans-unit id="feature_2_desc">
        <source>All data is encrypted at rest and in transit using industry-standard protocols.</source>
        <target>すべてのデータは業界標準のプロトコルを使用して、保存時および転送時に暗号化されています。</target>
      </trans-unit>
      <trans-unit id="cta_heading">
        <source>Ready to get started?</source>
        <target>始める準備はできていますか？</target>
      </trans-unit>
      <trans-unit id="cta_subtext">
        <source>Join thousands of teams already using our service.</source>
        <target>すでに私たちのサービスを使用している何千ものチームに参加してください。</target>
      </trans-unit>
      <trans-unit id="footer_privacy">
        <source>Privacy Policy</source>
        <target>プライバシーポリシー</target>
      </trans-unit>
    </body>
  </file>
</xliff>`

  const { writeFileSync, mkdirSync } = await import("fs")
  const { join } = await import("path")

  const uploadDir = join(process.cwd(), "uploads")
  mkdirSync(uploadDir, { recursive: true })
  const xliffPath = join(uploadDir, "sample-ja.xliff")
  writeFileSync(xliffPath, sampleXliff, "utf-8")

  // Parse and create project
  const existingProject = await prisma.project.findFirst({
    where: { name: "Sample: Product UI (EN→JA)" },
  })

  if (!existingProject) {
    const project = await prisma.project.create({
      data: {
        name: "Sample: Product UI (EN→JA)",
        sourceLanguage: "en-US",
        targetLanguage: "ja-JP",
        xliffFileUrl: xliffPath,
        status: "in_review",
        createdById: admin.id,
        assignedReviewerId: jaReviewer.id,
      },
    })

    const units = [
      { id: "welcome_title", src: "Welcome to our platform", tgt: "私たちのプラットフォームへようこそ" },
      { id: "signup_button", src: "Sign up for free", tgt: "無料で登録する" },
      { id: "login_prompt", src: "Already have an account? Log in", tgt: "すでにアカウントをお持ちですか？ログイン" },
      { id: "feature_1_title", src: "Fast and reliable", tgt: "速くて信頼性が高い" },
      { id: "feature_1_desc", src: "Our platform processes requests in milliseconds so you never wait.", tgt: "私たちのプラットフォームはミリ秒でリクエストを処理するので、待つことはありません。" },
      { id: "feature_2_title", src: "Secure by default", tgt: "デフォルトで安全" },
      { id: "feature_2_desc", src: "All data is encrypted at rest and in transit using industry-standard protocols.", tgt: "すべてのデータは業界標準のプロトコルを使用して、保存時および転送時に暗号化されています。" },
      { id: "cta_heading", src: "Ready to get started?", tgt: "始める準備はできていますか？" },
      { id: "cta_subtext", src: "Join thousands of teams already using our service.", tgt: "すでに私たちのサービスを使用している何千ものチームに参加してください。" },
      { id: "footer_privacy", src: "Privacy Policy", tgt: "プライバシーポリシー" },
    ]

    await prisma.translationUnit.createMany({
      data: units.map((u, i) => ({
        projectId: project.id,
        xliffUnitId: u.id,
        sourceText: u.src,
        targetText: u.tgt,
        orderIndex: i,
        metadata: "{}",
      })),
    })

    await prisma.reviewSession.create({
      data: { projectId: project.id, reviewerId: jaReviewer.id },
    })

    console.log("Created sample project:", project.id)
  }

  console.log("\nSeed complete! Test accounts:")
  console.log("  Admin:     admin@example.com / admin123")
  console.log("  Reviewer:  keiko@example.com / reviewer123  (ja-JP)")
  console.log("  Reviewer:  wei@example.com   / reviewer123  (zh-CN)")
  console.log("  Requester: requester@example.com / requester123")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
