using System.Text.Json;
using Servidor.Modelos;

namespace Servidor.Servicios;

/// <summary>
/// Lee el directorio de portales desde Datos/portales.json y lo valida.
/// Se recarga solo cuando el archivo cambia, así que editar el JSON no exige
/// reiniciar el servidor.
/// </summary>
public class DirectorioService(IWebHostEnvironment entorno, ILogger<DirectorioService> log)
{
    private static readonly JsonSerializerOptions Opciones = new(JsonSerializerDefaults.Web);

    private readonly string _ruta = Path.Combine(entorno.ContentRootPath, "Datos", "portales.json");
    private readonly Lock _candado = new();
    private Directorio? _cache;
    private DateTime _leidoEn;

    public Directorio Obtener()
    {
        var modificado = File.GetLastWriteTimeUtc(_ruta);
        lock (_candado)
        {
            if (_cache is not null && modificado == _leidoEn)
                return _cache;

            using var flujo = File.OpenRead(_ruta);
            var directorio = JsonSerializer.Deserialize<Directorio>(flujo, Opciones)
                ?? throw new InvalidDataException("portales.json está vacío.");

            var errores = Validar(directorio);
            if (errores.Count > 0)
                throw new InvalidDataException(
                    "portales.json tiene errores:\n - " + string.Join("\n - ", errores));

            _cache = directorio;
            _leidoEn = modificado;
            log.LogInformation("Directorio cargado: {Categorias} categorías, {Portales} portales",
                directorio.Categories.Count, directorio.Portals.Count);
            return directorio;
        }
    }

    /// <summary>Reglas que protegen la landing de un JSON mal editado.</summary>
    public static List<string> Validar(Directorio d)
    {
        var errores = new List<string>();
        var ids = d.Categories.Select(c => c.Id).ToHashSet();
        var nombres = new HashSet<string>();

        foreach (var c in d.Categories)
        {
            if (string.IsNullOrWhiteSpace(c.Id) || string.IsNullOrWhiteSpace(c.Name))
                errores.Add("Hay una categoría sin id o sin nombre.");
            if (!System.Text.RegularExpressions.Regex.IsMatch(c.Color ?? "", "^#[0-9a-fA-F]{6}$"))
                errores.Add($"La categoría '{c.Id}' tiene un color inválido: '{c.Color}'.");
        }
        if (ids.Count != d.Categories.Count)
            errores.Add("Hay ids de categoría repetidos.");

        foreach (var p in d.Portals)
        {
            if (!nombres.Add(p.Name))
                errores.Add($"El portal '{p.Name}' está repetido.");
            if (!ids.Contains(p.Category))
                errores.Add($"El portal '{p.Name}' usa la categoría '{p.Category}', que no existe.");
            if (!Uri.TryCreate(p.Url, UriKind.Absolute, out var uri) || uri.Scheme is not ("https" or "http"))
                errores.Add($"El portal '{p.Name}' tiene una URL inválida: '{p.Url}'.");
            if (string.IsNullOrWhiteSpace(p.Desc))
                errores.Add($"El portal '{p.Name}' no tiene descripción.");
        }

        foreach (var f in d.Favorites)
            if (!nombres.Contains(f))
                errores.Add($"El favorito '{f}' no corresponde a ningún portal.");

        foreach (var c in d.Categories.Where(c => d.Portals.All(p => p.Category != c.Id)))
            errores.Add($"La categoría '{c.Id}' no tiene portales.");

        return errores;
    }
}
