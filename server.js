// まずexpressを使えるようにしましょう
const express = require("express");

const cors = require("cors");
// → CORS: 異なるドメイン間の通信を許可
//   Next.js（localhost:3000）からAPI（localhost:5000）にアクセスできるようにする

const { PrismaClient } = require("./generated/prisma");
// → Prisma Client: データベースを操作するためのクラス
//   prisma.post.findMany() などでCRUD操作ができる

// ここで実行をしてappの箱の中にexpressの機能を使えるようにしています
const app = express();
const PORT = 8888;

const prisma = new PrismaClient();
// → Prisma Client のインスタンスを作成
//   この prisma を使ってDBを操作する

// ========================================
// ミドルウェアの設定
// ========================================
// ミドルウェア = リクエストを処理する前に実行される関数
// 全てのリクエストに対して共通の処理を行う

app.use(cors());
// → CORS を許可
//   これがないと Next.js から API にアクセスできない

app.use(express.json());
// → JSON リクエストを解析
//   req.body でJSONデータを受け取れるようにする

// 1.ここから簡単なAPiを作ります。
// 動作確認用
app.get("/", (req, res) => {
  // resはresponse返答します！の意味です
  res.send("<h1>おおほりは長野で研究をしています</h1>");
});

// ========================================
// 投稿一覧取得 API
// ========================================
// GET /api/posts にアクセスしたときの処理

app.get("/api/posts", async (req, res) => {
  try {
    const posts = await prisma.post.findMany({
      // prisma.post = Postテーブルを操作
      orderBy: { createdAt: "desc" },
    });
    if(posts.length === 0) {
      return res.json({ message: "投稿がひとつもありません"});
    }
    res.json(posts);
    // 取得したデータをJSONで返す
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "投稿の取得に失敗しました" });
  }
});

// ========================================
// 投稿作成 API
// ========================================
// POST /api/posts にアクセスしたときの処理
app.post("/api/posts", async (req, res) => {
  try {
    // ここで送られたデータを受け取ります
    const { content, imageUrl, userId } = req.body;
    // req.body = データの塊でAPIでデータが送られる場所になっている。そこから分割代入というjsのテクニックを使って抜き出しています。

    // バリデーションのチェックをする。
    if (!content || content.trim() === "") {
      // エラーを通知させる。その結果をresponseとして返却
      return res.status(400).json({
        error: "投稿の中身が空なので入力してください",
      });
    }

    // 登録の処理の場所です。prismaを使って実際に登録するフェーズ
    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        userId: userId || null,
      },
    });

    // この形式をDBに登録した後に成功したという結果をstatusでお知らせとデータを戻してくれる
    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "投稿の作成に失敗しました" });
  }
});

// ========================================
// 投稿削除 API
// ========================================
// DELETE /api/posts/:id にアクセスしたときの処理
// :id = パスパラメータ（URL の一部として ID を受け取る）

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    // req.params = URLのパスパラメータ
    // req.params.id = :idの部分の値
    // parseInt() = 文字列を整数に変換
    if (isNaN(id)) {
      return res.status(400).json({ error: "無効なIDです" });
    }

    await prisma.post.delete({ where: { id } });

    res.json({ message: `投稿${id}を削除しました` });
  } catch (error) {
    console.error("Error deleting post:", error);
    if (error.code === "P2025") {
      // P2025 = Prismaのエラーコード（レコードが見つからない）
      return res.status(404).json({ error: "投稿が見つかりません" });
    }
    res.status(500).json({ error: "投稿の削除に失敗しました" });
  }
});

// ここでサーバを起動させます。必ず一番下に書く。listenがないと動きません。これでアクセスをしたらサーバが動きます
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
