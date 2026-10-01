using Servidor.Servicios;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<DirectorioService>();

// En desarrollo, Angular corre aparte en el puerto 4200 y llama a este API.
builder.Services.AddCors(o => o.AddPolicy("desarrollo", p => p
    .WithOrigins("http://localhost:4200")
    .AllowAnyHeader()
    .AllowAnyMethod()));

var app = builder.Build();

if (app.Environment.IsDevelopment())
    app.UseCors("desarrollo");

// La landing compilada de Angular vive en wwwroot. Se sirve desde aquí en
// producción, así que un solo proceso publica el sitio y el API.
app.UseDefaultFiles();
app.UseStaticFiles();

// Mismo contrato que el Portal ISI: /api/health y /api/sistemas.
app.MapGet("/api/health", () => Results.Ok(new
{
    estado = "ok",
    servicio = "landing-portales",
    fecha = DateTimeOffset.Now
}));

app.MapGet("/api/sistemas", (DirectorioService directorio, ILogger<Program> log) =>
{
    try
    {
        return Results.Ok(directorio.Obtener());
    }
    catch (InvalidDataException ex)
    {
        log.LogError("{Mensaje}", ex.Message);
        return Results.Problem(ex.Message, title: "Datos de portales inválidos", statusCode: 500);
    }
});

// Cualquier ruta que no sea del API vuelve a la landing.
app.MapFallbackToFile("index.html");

app.Run();
