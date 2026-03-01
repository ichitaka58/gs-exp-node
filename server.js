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
// ========================================
// CORS 設定を更新
// ========================================

// --- Day4 変更 ここから ---
// 本番環境では特定のオリジンのみ許可
const corsOptions = {
  origin: [
    "http://localhost:3000",
    "https://gs-exp-next-eta.vercel.app",  // あなたの Vercel URL
    // 他の Vercel URL がある場合は追加
  ],
  credentials: true,
};

app.use(cors(corsOptions));
// --- Day4 変更 ここまで ---

// app.use(cors());
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
// 投稿一覧取得 API（更新版）
// ========================================
// いいね数といいね状態も含めて取得
// 既存の app.get("/api/posts") を以下に置き換え

app.get("/api/posts", async (req, res) => {
  try {
    // クエリパラメータからユーザーIDを取得（任意）
    // 例: /api/posts?userId=xxx
    const userId = req.query.userId;

    const posts = await prisma.post.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        // ========================================
        // いいねの数を取得
        // ========================================
        // _count = リレーション先の数をカウント
        _count: {
          select: { likes: true },
        },

        // ========================================
        // 現在のユーザーがいいねしているかどうか
        // ========================================
        likes: userId
          ? {
            // userId が指定されていれば、そのユーザーのいいねだけ取得
            where: { userId },
            select: { id: true },
          }
          : false,
        // userId がなければ取得しない（false）
      },
    });

    // レスポンス用にデータを整形
    // API の利用者が使いやすい形に変換
    const formattedPosts = posts.map((post) => ({
      id: post.id,
      content: post.content,
      imageUrl: post.imageUrl,
      userId: post.userId,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
      likeCount: post._count.likes,
      // → _count.likes = いいねの数
      isLiked: userId ? post.likes.length > 0 : false,
      // → likes 配列に要素があれば true
    }));

    res.json(formattedPosts);
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({ error: "投稿の取得に失敗しました" });
  }
});

// ========================================
// 投稿作成 API
// ========================================
// POST /api/posts

app.post("/api/posts", async (req, res) => {
  try {
    const { content, imageUrl, userId } = req.body;

    if (!content || content.trim() === "") {
      return res.status(400).json({ error: "投稿内容を入力してください" });
    }

    const post = await prisma.post.create({
      data: {
        content: content.trim(),
        imageUrl: imageUrl || null,
        userId: userId || null,
      },
    });

    res.status(201).json(post);
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({ error: "投稿の作成に失敗しました" });
  }
});

// ========================================
// 投稿削除 API
// ========================================
// DELETE /api/posts/:id

app.delete("/api/posts/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "無効なIDです" });
    }

    await prisma.post.delete({
      where: { id },
    });

    res.json({ message: "投稿を削除しました" });
  } catch (error) {
    console.error("Error deleting post:", error);

    if (error.code === "P2025") {
      return res.status(404).json({ error: "投稿が見つかりません" });
    }

    res.status(500).json({ error: "投稿の削除に失敗しました" });
  }
});

// ========================================
// いいね追加 API
// ========================================
// POST /api/posts/:id/like

app.post("/api/posts/:id/like", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    // → URL から投稿IDを取得
    //   /api/posts/1/like → 1

    const { userId } = req.body;
    // → リクエストボディからユーザーIDを取得

    // バリデーション
    if (isNaN(postId)) {
      return res.status(400).json({ error: "無効な投稿IDです" });
    }
    if (!userId) {
      return res.status(400).json({ error: "ユーザーIDが必要です" });
    }

    // いいねを作成
    const like = await prisma.like.create({
      data: {
        postId,
        userId,
      },
    });
    // → すでに存在する場合は @@unique 制約でエラーになる

    // いいね数を取得して返す
    const likeCount = await prisma.like.count({
      where: { postId },
    });

    res.status(201).json({ likeCount, isLiked: true });
  } catch (error) {
    // すでにいいねしている場合
    if (error.code === "P2002") {
      // P2002 = ユニーク制約違反（すでに存在する）
      return res.status(400).json({ error: "すでにいいねしています" });
    }
    console.error("Error creating like:", error);
    res.status(500).json({ error: "いいねに失敗しました" });
  }
});

// ========================================
// いいね削除 API
// ========================================
// DELETE /api/posts/:id/like

app.delete("/api/posts/:id/like", async (req, res) => {
  try {
    const postId = parseInt(req.params.id);
    const { userId } = req.body;

    // バリデーション
    if (isNaN(postId)) {
      return res.status(400).json({ error: "無効な投稿IDです" });
    }
    if (!userId) {
      return res.status(400).json({ error: "ユーザーIDが必要です" });
    }

    // いいねを削除
    await prisma.like.deleteMany({
      // deleteMany = 条件に一致する全てを削除
      // delete だと見つからない場合にエラーになるが
      // deleteMany は見つからなくても OK
      where: {
        postId,
        userId,
      },
    });

    // いいね数を取得して返す
    const likeCount = await prisma.like.count({
      where: { postId },
    });

    res.json({ likeCount, isLiked: false });
  } catch (error) {
    console.error("Error deleting like:", error);
    res.status(500).json({ error: "いいねの削除に失敗しました" });
  }
});

// ここでサーバを起動させます。必ず一番下に書く。listenがないと動きません。これでアクセスをしたらサーバが動きます
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
