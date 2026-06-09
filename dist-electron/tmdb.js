"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchMovies = searchMovies;
exports.searchSeries = searchSeries;
exports.getMovieDetails = getMovieDetails;
exports.getTvDetails = getTvDetails;
exports.getPosterUrl = getPosterUrl;
exports.getBackdropUrl = getBackdropUrl;
const dotenv = __importStar(require("dotenv"));
const path_1 = __importDefault(require("path"));
dotenv.config({ path: path_1.default.join(__dirname, '../.env') });
const API_KEY = process.env.TMDB_API_KEY ?? '';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_URL = 'https://image.tmdb.org/t/p/';
async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok)
        throw new Error(`TMDB error: ${res.status}`);
    return res.json();
}
async function searchMovies(query) {
    if (!API_KEY)
        return [];
    const url = `${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`;
    const data = await fetchJson(url);
    return (data.results ?? []).slice(0, 10).map(r => ({ ...r, media_type: 'movie' }));
}
async function searchSeries(query) {
    if (!API_KEY)
        return [];
    const url = `${BASE_URL}/search/tv?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=pt-BR`;
    const data = await fetchJson(url);
    return (data.results ?? []).slice(0, 10).map(r => ({
        id: r.id,
        title: r.name,
        overview: r.overview,
        release_date: r.first_air_date,
        poster_path: r.poster_path,
        media_type: 'tv',
    }));
}
async function getMovieDetails(id) {
    const url = `${BASE_URL}/movie/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=credits`;
    return fetchJson(url);
}
async function getTvDetails(id) {
    const url = `${BASE_URL}/tv/${id}?api_key=${API_KEY}&language=pt-BR&append_to_response=credits`;
    return fetchJson(url);
}
function getPosterUrl(path, size = 'w500') {
    if (!path)
        return null;
    return `${IMG_URL}${size}${path}`;
}
function getBackdropUrl(backdropPath, size = 'w1280') {
    if (!backdropPath)
        return '';
    return `${IMG_URL}${size}${backdropPath}`;
}
