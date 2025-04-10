import { Injectable } from '@angular/core';

interface FavoriteVideo {
  url: string;
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly STORAGE_KEY = 'youtube_favorites';

  constructor() { }

  getFavorites(): FavoriteVideo[] {
    const favorites = localStorage.getItem(this.STORAGE_KEY);
    return favorites ? JSON.parse(favorites) : [];
  }

  addFavorite(url: string, title: string): void {
    const favorites = this.getFavorites();
    if (!favorites.some(f => f.url === url)) {
      favorites.push({ url, title });
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
    }
  }

  removeFavorite(url: string): void {
    const favorites = this.getFavorites();
    const index = favorites.findIndex(f => f.url === url);
    if (index > -1) {
      favorites.splice(index, 1);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(favorites));
    }
  }

  isFavorite(url: string): boolean {
    return this.getFavorites().some(f => f.url === url);
  }
} 