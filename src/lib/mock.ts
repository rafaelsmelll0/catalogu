import type { Media } from '../types/index.ts'

export const MOCK_MEDIA: Media[] = [
  {
    id: 1, title: 'Duna: Parte II', release_year: '2024', tipo: 'filme',
    watched_status: 'assistido', rating: 9.2, duration: 166,
    synopsis: 'Paul Atreides se une a Chani e aos Fremen enquanto busca vingança contra os conspiradores que destruíram sua família.',
    genres: ['Ficção Científica', 'Aventura', 'Drama'], created_at: '',
  },
  {
    id: 2, title: 'Blade Runner 2049', release_year: '2017', tipo: 'filme',
    watched_status: 'assistido', rating: 8.5, duration: 163,
    synopsis: 'Um jovem blade runner descobre um segredo que pode mergulhar o que resta da sociedade no caos.',
    genres: ['Ficção Científica', 'Drama', 'Thriller'], created_at: '',
  },
  {
    id: 3, title: 'Oppenheimer', release_year: '2023', tipo: 'filme',
    watched_status: 'nao_assistido', duration: 180,
    synopsis: 'A história do físico J. Robert Oppenheimer e seu papel no desenvolvimento da bomba atômica.',
    genres: ['Drama', 'História', 'Thriller'], created_at: '',
  },
  {
    id: 4, title: 'Neon Genesis Evangelion', release_year: '1995', tipo: 'serie',
    watched_status: 'assistido', rating: 10.0, duration: 26,
    synopsis: 'Shinji Ikari é recrutado por seu pai para pilotar um robô gigante chamado Evangelion.',
    genres: ['Ação', 'Ficção Científica', 'Psicológico'], created_at: '',
  },
  {
    id: 5, title: 'Past Lives', release_year: '2023', tipo: 'filme',
    watched_status: 'assistido', rating: 8.0, duration: 106,
    synopsis: 'Dois amigos de infância se reúnem décadas depois em Nova York.',
    genres: ['Drama', 'Romance'], created_at: '',
  },
  {
    id: 6, title: 'Breaking Bad', release_year: '2008', tipo: 'serie',
    watched_status: 'assistido', rating: 9.8, duration: 62, watched: 62,
    synopsis: 'Um professor de química se torna um fabricante de metanfetamina após ser diagnosticado com câncer.',
    genres: ['Drama', 'Crime', 'Thriller'], created_at: '',
  },
  {
    id: 7, title: 'Poor Things', release_year: '2023', tipo: 'filme',
    watched_status: 'assistindo', rating: 7.8, duration: 141,
    synopsis: 'A incrível história de Bella Baxter, uma jovem mulher trazida de volta à vida pelo brilhante cirurgião Dr. Godwin Baxter.',
    genres: ['Ficção Científica', 'Comédia', 'Romance'], created_at: '',
  },
  {
    id: 8, title: 'Shogun', release_year: '2024', tipo: 'serie',
    watched_status: 'assistido', rating: 9.5, duration: 10, watched: 10,
    synopsis: 'Um navegador inglês chega ao Japão feudal e se torna peão em um jogo de poder.',
    genres: ['Drama', 'História', 'Guerra'], created_at: '',
  },
  {
    id: 9, title: 'Inception', release_year: '2010', tipo: 'filme',
    watched_status: 'nao_assistido', duration: 148,
    synopsis: 'Um ladrão que entra nos sonhos das pessoas é oferecido a chance de ter sua vida apagada como pagamento por uma tarefa impossível.',
    genres: ['Ação', 'Ficção Científica', 'Thriller'], created_at: '',
  },
  {
    id: 10, title: 'Fullmetal Alchemist: Brotherhood', release_year: '2009', tipo: 'serie',
    watched_status: 'assistido', rating: 9.6, duration: 64, watched: 64,
    synopsis: 'Dois irmãos buscam a Pedra Filosofal para restaurar seus corpos após uma alquimia proibida.',
    genres: ['Ação', 'Aventura', 'Fantasia'], created_at: '',
  },
]
