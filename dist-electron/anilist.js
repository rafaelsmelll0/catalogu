"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchAnime = searchAnime;
const API_URL = 'https://graphql.anilist.co';
async function searchAnime(query) {
    const gql = `
    query ($search: String) {
      Page(perPage: 10) {
        media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
          id
          title { romaji english }
          description(asHtml: false)
          episodes
          startDate { year }
          genres
          coverImage { large }
        }
      }
    }
  `;
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: gql, variables: { search: query } }),
        });
        const data = await res.json();
        return (data.data?.Page?.media ?? []).map(m => ({
            id: m.id,
            title: m.title.english || m.title.romaji,
            description: (m.description ?? '').replace(/<[^>]+>/g, ''),
            year: m.startDate?.year ?? null,
            episodes: m.episodes,
            genres: m.genres,
            coverImage: m.coverImage?.large ?? null,
        }));
    }
    catch {
        return [];
    }
}
