export async function fetchComments(postId: string, token: string) {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/comments`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  if (!res.ok) throw new Error('FETCH_COMMENTS_FAILED');
  return res.json();
}

export async function addComment(
  postId: string,
  text: string,
  token: string
) {
  const res = await fetch(
    `${process.env.EXPO_PUBLIC_API_URL}/posts/${postId}/comments`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!res.ok) throw new Error('ADD_COMMENT_FAILED');
  return res.json();
}
