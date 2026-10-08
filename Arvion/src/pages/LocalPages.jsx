import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import brandingLogo from '../../arvion-logo/arvion-logo.jpeg'
import { supabase } from '../lib/supabase'
import '../local.css'

const IMAGE_BUCKET = 'local-service-images'
const SERVICE_SELECT = 'id,provider_id,category_id,title,description,price_minor,currency,location_area,location_city,location_state,location_country,status,created_at,updated_at,category:categories(name,slug),images:local_service_images(id,storage_path,sort_order)'
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function LocalHeader({ active = 'local', action }) {
  return (
    <header className="local-header">
      <div className="local-header-inner">
        <Link to="/" className="local-brand" aria-label="Return to Arvion home">
          <img src={brandingLogo} alt="" />
          <span>Arvion</span>
        </Link>
        <nav className="local-nav" aria-label="Arvion areas">
          <Link to="/welcome">Home</Link>
          <Link to="/market">Market</Link>
          <Link to="/local" className={active === 'local' ? 'active' : ''}>Local</Link>
        </nav>
        <Link className="local-header-action" to={action?.to || '/local/new'}>
          {action?.label || 'Offer a Service'} <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </header>
  )
}

function parsePriceMinor(value) {
  const match = value.trim().match(/^(\d{1,17})(?:\.(\d{1,2}))?$/)
  if (!match) return null
  const minor = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'))
  if (minor <= 0n || minor > 9223372036854775807n) return null
  return minor.toString()
}

function formatPrice(priceMinor, currency = 'NGN') {
  const amount = Number(priceMinor) / 100
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(amount)
  } catch {
    return `${currency} ${amount.toLocaleString()}`
  }
}

function formatLocation(service) {
  return [service.location_area, service.location_city, service.location_state, service.location_country]
    .filter(Boolean)
    .join(', ')
}

function safeFileName(fileName) {
  return fileName.normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-').slice(-100) || 'image'
}

function useLocalImageUrls(images = []) {
  const pathsKey = JSON.stringify(
    [...images].sort((first, second) => (first.sort_order ?? 0) - (second.sort_order ?? 0)).map((image) => image.storage_path),
  )
  const [imageUrls, setImageUrls] = useState([])
  const [imageError, setImageError] = useState('')

  useEffect(() => {
    let isCurrent = true

    const loadImages = async () => {
      const paths = JSON.parse(pathsKey)
      if (!supabase || paths.length === 0) {
        setImageUrls([])
        setImageError('')
        return
      }

      const { data, error } = await supabase.storage.from(IMAGE_BUCKET).createSignedUrls(paths, 3600)
      if (!isCurrent) return
      if (error) {
        setImageUrls([])
        setImageError('Service images could not be accessed from private storage.')
        return
      }
      const urls = (data || []).map((image) => image.signedUrl).filter(Boolean)
      setImageUrls(urls)
      setImageError(urls.length < paths.length ? 'One or more service images could not be accessed.' : '')
    }

    loadImages()
    return () => {
      isCurrent = false
    }
  }, [pathsKey])

  return { imageUrls, imageError }
}

async function loadProviderIdentities(services) {
  if (!services.length) return {}
  if (!supabase) throw new Error('Supabase is not configured.')

  const { data, error } = await supabase.rpc('get_local_service_provider_identities', {
    p_service_ids: services.map((service) => service.id),
  })
  if (error) throw error

  return Object.fromEntries((data || []).map((identity) => [identity.service_id, identity]))
}

function LocalServiceImage({ service, className = '' }) {
  const { imageUrls, imageError } = useLocalImageUrls(service.images || [])
  return imageUrls[0]
    ? <img className={className} src={imageUrls[0]} alt={service.title} />
    : <div className={`${className} local-image-placeholder`} aria-label={imageError || 'No service image available'}><span aria-hidden="true">✳</span></div>
}

function ProviderLabel({ identity }) {
  const arvionId = identity?.arvion_id
  const username = identity?.username
  return (
    <span className="local-provider-label">
      <span className="local-provider-avatar" aria-hidden="true">{(identity?.display_name || 'A').slice(0, 1).toUpperCase()}</span>
      <span>{arvionId ? `@${arvionId}` : username ? `@${username}` : identity?.display_name || 'Arvion provider'}</span>
    </span>
  )
}

function LocalServiceCard({ service, identity }) {
  return (
    <Link className="local-service-card" to={`/local/${service.id}`}>
      <LocalServiceImage service={service} className="local-service-image" />
      <div className="local-service-card-copy">
        <div className="local-service-card-kicker">
          <span>{service.category?.name || 'Local service'}</span>
          <span aria-hidden="true">↗</span>
        </div>
        <h3>{service.title}</h3>
        <ProviderLabel identity={identity} />
        <div className="local-card-bottom">
          <span>{formatLocation(service)}</span>
          <strong>From {formatPrice(service.price_minor, service.currency)}</strong>
        </div>
      </div>
    </Link>
  )
}

function rankService(service, search) {
  if (!search) return 0
  const needle = search.toLocaleLowerCase()
  const title = service.title.toLocaleLowerCase()
  const description = service.description.toLocaleLowerCase()
  const category = (service.category?.name || '').toLocaleLowerCase()
  const location = formatLocation(service).toLocaleLowerCase()
  if (title === needle) return 4
  if (title.startsWith(needle)) return 3
  if (title.includes(needle)) return 2
  if (category.includes(needle)) return 1
  if (description.includes(needle) || location.includes(needle)) return 0
  return -1
}

export function LocalPage() {
  const [categories, setCategories] = useState([])
  const [services, setServices] = useState([])
  const [identities, setIdentities] = useState({})
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [sortOrder, setSortOrder] = useState('relevant')
  const [loading, setLoading] = useState(true)
  const [categoryError, setCategoryError] = useState('')
  const [serviceError, setServiceError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const loadCategories = async () => {
      if (!supabase) {
        setCategoryError('Local categories are unavailable because Supabase is not configured.')
        return
      }
      const { data, error } = await supabase
        .from('categories')
        .select('id,name,slug,sort_order')
        .eq('domain', 'LOCAL_JOB')
        .eq('active', true)
        .order('sort_order')

      if (!isCurrent) return
      if (error) setCategoryError('Local categories could not be loaded. Please refresh and try again.')
      else setCategories(data || [])
    }

    loadCategories()
    return () => {
      isCurrent = false
    }
  }, [])

  useEffect(() => {
    let isCurrent = true
    const loadServices = async () => {
      if (!supabase) {
        setServiceError('Local services are unavailable because Supabase is not configured.')
        setServices([])
        setIdentities({})
        setLoading(false)
        return
      }
      setLoading(true)
      setServiceError('')

      let query = supabase
        .from('local_service_listings')
        .select(SERVICE_SELECT)
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false })
        .limit(1000)

      if (categoryId) query = query.eq('category_id', categoryId)

      const { data, error } = await query
      if (!isCurrent) return

      if (error) {
        setServiceError('Local services could not be loaded. Please try again.')
        setServices([])
        setIdentities({})
      } else {
        try {
          const providerIdentities = await loadProviderIdentities(data || [])
          if (!isCurrent) return
          setServices(data || [])
          setIdentities(providerIdentities)
        } catch {
          setServiceError('Provider identities could not be loaded. Please try again.')
          setServices([])
          setIdentities({})
        }
      }
      setLoading(false)
    }
    loadServices()

    return () => {
      isCurrent = false
    }
  }, [categoryId])

  const visibleServices = useMemo(() => {
    const needle = search.trim()
    const filtered = needle
      ? services.filter((service) => rankService(service, needle) >= 0)
      : services
    if (sortOrder === 'newest') return filtered
    return [...filtered].sort((first, second) => rankService(second, needle) - rankService(first, needle))
  }, [services, search, sortOrder])

  return (
    <div className="local-shell">
      <LocalHeader />
      <main className="local-main">
        <section className="local-hero">
          <div className="local-hero-copy">
            <span className="local-eyebrow">People to help you get it done</span>
            <h1>Find your next<br /><em>local expert.</em></h1>
            <p>Discover independent professionals and services around your community. Local is for people you hire — not products you buy.</p>
            <Link to="/local/new" className="local-hero-action">Offer a Service <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="local-hero-aside" aria-label="Local service marketplace">
            <span className="local-orbit local-orbit-one" aria-hidden="true">✳</span>
            <span className="local-orbit local-orbit-two" aria-hidden="true">⌖</span>
            <div className="local-hero-note">
              <span>LOCAL, MADE HUMAN</span>
              <strong>Trusted skills.<br />Closer to home.</strong>
              <span>Independent providers · Real services</span>
            </div>
          </div>
        </section>

        <section className="local-discovery" aria-label="Find local services">
          <div className="local-discovery-top">
            <div>
              <span className="local-eyebrow">Discover nearby talent</span>
              <h2>Who can help?</h2>
            </div>
            <label className="local-sort">
              <span>Sort by</span>
              <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value)} aria-label="Sort Local services">
                <option value="relevant">Relevant</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>

          <label className="local-search">
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Try a plumber, tutor, photographer..."
              aria-label="Search Local services"
            />
            {search ? <button type="button" onClick={() => setSearch('')} aria-label="Clear Local search">×</button> : null}
          </label>

          <div className="local-categories" aria-label="Filter Local services by category">
            <button type="button" className={!categoryId ? 'selected' : ''} onClick={() => setCategoryId('')}>All services</button>
            {categories.map((category) => (
              <button
                type="button"
                key={category.id}
                className={categoryId === category.id ? 'selected' : ''}
                onClick={() => setCategoryId(category.id)}
              >
                {category.name}
              </button>
            ))}
          </div>
          {categoryError ? <p className="local-inline-error" role="alert">{categoryError}</p> : null}
        </section>

        <section className="local-results" aria-labelledby="local-services-heading">
          <div className="local-results-heading">
            <div><span className="local-eyebrow">Good people, great work</span><h2 id="local-services-heading">Services in Local</h2></div>
            <span>{sortOrder === 'newest' ? 'Recently added ↓' : 'Matched to your search ✳'}</span>
          </div>
          {serviceError ? <div className="local-alert" role="alert">{serviceError}</div> : null}
          {loading ? <p className="local-status" role="status">Finding local services…</p> : null}
          {!loading && !serviceError && visibleServices.length ? (
            <div className="local-service-grid">
              {visibleServices.map((service) => <LocalServiceCard key={service.id} service={service} identity={identities[service.id]} />)}
            </div>
          ) : null}
          {!loading && !serviceError && !visibleServices.length ? (
            <div className="local-empty">
              <span aria-hidden="true">✳</span>
              <p>{search || categoryId ? 'No services match that search yet.' : 'The local directory is just getting started.'}</p>
              <strong>Know a great provider? Invite them to offer a service.</strong>
              <Link to="/local/new">Offer a Service <span aria-hidden="true">↗</span></Link>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

export function CreateLocalServicePage({ session }) {
  const navigate = useNavigate()
  const [categories, setCategories] = useState([])
  const [categoryId, setCategoryId] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('NGN')
  const [area, setArea] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('Nigeria')
  const [status, setStatus] = useState('ACTIVE')
  const [files, setFiles] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let isCurrent = true
    const loadFormData = async () => {
      const [{ data: categoryData, error: categoryError }, { data: profile, error: profileError }] = await Promise.all([
        supabase.from('categories').select('id,name,sort_order').eq('domain', 'LOCAL_JOB').eq('active', true).order('sort_order'),
        supabase.from('profiles').select('currency').eq('auth_user_id', session.user.id).maybeSingle(),
      ])

      if (!isCurrent) return
      if (categoryError) setError('Local categories could not be loaded. Please refresh and try again.')
      if (profileError) setError('Your account preferences could not be loaded. You can still choose a currency manually.')
      setCategories(categoryData || [])
      if (profile?.currency) setCurrency(profile.currency)
      setLoadingCategories(false)
    }

    loadFormData()
    return () => {
      isCurrent = false
    }
  }, [session.user.id])

  const handleSubmit = async (event) => {
    event.preventDefault()
    setError('')
    const priceMinor = parsePriceMinor(price)
    const normalizedCurrency = currency.trim().toUpperCase()
    const selectedFiles = Array.from(files)

    if (title.trim().length < 3) return setError('Service title must be at least 3 characters.')
    if (title.trim().length > 120) return setError('Service title must be 120 characters or fewer.')
    if (description.trim().length < 10) return setError('Description must be at least 10 characters.')
    if (description.trim().length > 5000) return setError('Description must be 5,000 characters or fewer.')
    if (!categoryId) return setError('Choose a Local service category.')
    if (!area.trim()) return setError('Area is required.')
    if (!country.trim()) return setError('Country is required.')
    if (area.trim().length > 120) return setError('Area must be 120 characters or fewer.')
    if (!/^[A-Z]{3}$/.test(normalizedCurrency)) return setError('Enter a valid three-letter currency code, such as NGN.')
    if (priceMinor === null) return setError('Enter a positive price with up to two decimal places.')
    if (!['DRAFT', 'ACTIVE'].includes(status)) return setError('Choose a valid service status.')
    if (selectedFiles.length > 5 || selectedFiles.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      return setError('Choose up to 5 JPG, PNG, or WebP images, each no larger than 5 MB.')
    }

    setSubmitting(true)
    let serviceId
    const uploadedPaths = []
    try {
      const { data: service, error: insertError } = await supabase
        .from('local_service_listings')
        .insert({
          provider_id: session.user.id,
          category_id: categoryId,
          title: title.trim(),
          description: description.trim(),
          price_minor: priceMinor,
          currency: normalizedCurrency,
          location_area: area.trim(),
          location_city: city.trim() || null,
          location_state: state.trim() || null,
          location_country: country.trim(),
          status,
        })
        .select('id')
        .single()
      if (insertError) throw insertError
      serviceId = service.id

      for (const [index, file] of selectedFiles.entries()) {
        const path = `${serviceId}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        })
        if (uploadError) throw new Error(`Image upload failed: ${uploadError.message}`)
        uploadedPaths.push({ path, sort_order: index })
      }

      if (uploadedPaths.length) {
        const { error: imageError } = await supabase.from('local_service_images').insert(
          uploadedPaths.map(({ path, sort_order }) => ({
            service_id: serviceId,
            storage_path: path,
            sort_order,
          })),
        )
        if (imageError) throw new Error(`Image details could not be saved: ${imageError.message}`)
      }

      navigate(`/local/${serviceId}`, { replace: true })
    } catch (caughtError) {
      const cleanupErrors = []
      if (uploadedPaths.length) {
        const { error: cleanupError } = await supabase.storage.from(IMAGE_BUCKET).remove(uploadedPaths.map(({ path }) => path))
        if (cleanupError) cleanupErrors.push('Some uploaded images may need manual cleanup.')
      }
      if (serviceId) {
        const { error: deleteError } = await supabase.from('local_service_listings').delete().eq('id', serviceId)
        if (deleteError) cleanupErrors.push('The service was created but could not be removed.')
      }
      const listingError = caughtError.message?.startsWith('Image upload failed:')
        ? 'Your service was not published because an image could not be uploaded.'
        : caughtError.message?.startsWith('Image details could not be saved:')
          ? 'Your service was not published because its image details could not be saved.'
          : 'Your service could not be saved. Check the required details and try again.'
      setError([listingError, ...cleanupErrors].join(' '))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="local-shell">
      <LocalHeader action={{ to: '/local', label: 'Explore Local' }} />
      <main className="local-main local-form-main">
        <Link to="/local" className="local-back-link">← Back to Local</Link>
        <section className="local-form-intro">
          <span className="local-eyebrow">Share your skill with your community</span>
          <h1>Offer a Service</h1>
          <p>Create a clear service listing so people nearby can find the right person for the job.</p>
        </section>

        <form className="local-form" onSubmit={handleSubmit} noValidate>
          <section className="local-form-section">
            <div className="local-form-section-heading"><span>01</span><h2>What do you do?</h2></div>
            <label className="local-field">
              <span>Service title <b>*</b></span>
              <input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} placeholder="e.g. Residential plumbing and leak repairs" required />
            </label>
            <label className="local-field">
              <span>Tell people about your service <b>*</b></span>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={5000} rows={5} placeholder="Describe your experience, what is included, and what customers can expect." required />
            </label>
            <div className="local-field-grid">
              <label className="local-field">
                <span>Service category <b>*</b></span>
                <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required disabled={loadingCategories || categories.length === 0}>
                  <option value="">Select a Local category</option>
                  {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                </select>
              </label>
              <label className="local-field">
                <span>Service status <b>*</b></span>
                <select value={status} onChange={(event) => setStatus(event.target.value)}>
                  <option value="ACTIVE">Active — show in Local</option>
                  <option value="DRAFT">Draft — only you can see it</option>
                </select>
              </label>
            </div>
          </section>

          <section className="local-form-section">
            <div className="local-form-section-heading"><span>02</span><h2>Where and what price?</h2></div>
            <div className="local-field-grid local-price-grid">
              <label className="local-field">
                <span>Starting price <b>*</b></span>
                <input type="number" inputMode="decimal" min="0.01" step="0.01" value={price} onChange={(event) => setPrice(event.target.value)} placeholder="0.00" required />
              </label>
              <label className="local-field">
                <span>Currency <b>*</b></span>
                <input value={currency} onChange={(event) => setCurrency(event.target.value)} maxLength={3} placeholder="NGN" required />
              </label>
            </div>
            <div className="local-field-grid">
              <label className="local-field">
                <span>Area <b>*</b></span>
                <input value={area} onChange={(event) => setArea(event.target.value)} maxLength={120} placeholder="e.g. Ikeja" required />
              </label>
              <label className="local-field">
                <span>City</span>
                <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="e.g. Lagos" />
              </label>
              <label className="local-field">
                <span>State / region</span>
                <input value={state} onChange={(event) => setState(event.target.value)} placeholder="e.g. Lagos" />
              </label>
              <label className="local-field">
                <span>Country <b>*</b></span>
                <input value={country} onChange={(event) => setCountry(event.target.value)} maxLength={120} required />
              </label>
            </div>
          </section>

          <section className="local-form-section">
            <div className="local-form-section-heading"><span>03</span><h2>Show your work <small>Optional</small></h2></div>
            <label className="local-upload">
              <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setFiles(event.target.files || [])} />
              <span className="local-upload-icon" aria-hidden="true">＋</span>
              <strong>{files.length ? `${files.length} image${files.length === 1 ? '' : 's'} selected` : 'Add service images'}</strong>
              <span>Up to 5 JPG, PNG, or WebP images · 5 MB each · stored privately</span>
            </label>
          </section>

          {error ? <div className="local-alert" role="alert">{error}</div> : null}
          <div className="local-form-actions">
            <button type="submit" className="local-primary-button" disabled={submitting || loadingCategories || !categories.length}>
              {submitting ? 'Saving service...' : status === 'DRAFT' ? 'Save draft' : 'Publish service'} <span aria-hidden="true">↗</span>
            </button>
            <Link to="/local" className="local-cancel">Cancel</Link>
            <span>Your listing uses your signed-in Arvion account as its provider.</span>
          </div>
        </form>
      </main>
    </div>
  )
}

export function LocalServiceDetailPage({ session }) {
  const { serviceId } = useParams()
  const navigate = useNavigate()
  const [service, setService] = useState(null)
  const [identity, setIdentity] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [managementError, setManagementError] = useState('')
  const [managing, setManaging] = useState(false)
  const { imageUrls, imageError } = useLocalImageUrls(service?.images || [])
  const isOwner = Boolean(session?.user?.id && service?.provider_id === session.user.id)

  const loadService = async () => {
    setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('local_service_listings')
      .select(SERVICE_SELECT)
      .eq('id', serviceId)
      .maybeSingle()

    if (queryError) {
      setError('This service could not be loaded. Please try again.')
      setService(null)
    } else {
      setService(data)
      if (data) {
        try {
          const providerIdentities = await loadProviderIdentities([data])
          setIdentity(providerIdentities[data.id] || null)
        } catch {
          setError('The provider identity could not be loaded.')
        }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    let isCurrent = true
    const load = async () => {
      if (!supabase) {
        setError('This service is unavailable because Supabase is not configured.')
        setLoading(false)
        return
      }
      setLoading(true)
      setError('')
      const { data, error: queryError } = await supabase
        .from('local_service_listings')
        .select(SERVICE_SELECT)
        .eq('id', serviceId)
        .maybeSingle()
      if (!isCurrent) return

      if (queryError) {
        setError('This service could not be loaded. Please try again.')
        setService(null)
      } else {
        setService(data)
        if (data) {
          try {
            const providerIdentities = await loadProviderIdentities([data])
            if (isCurrent) setIdentity(providerIdentities[data.id] || null)
          } catch {
            if (isCurrent) setError('The provider identity could not be loaded.')
          }
        }
      }
      if (isCurrent) setLoading(false)
    }
    load()
    return () => {
      isCurrent = false
    }
  }, [serviceId])

  const handleStatusChange = async () => {
    if (!service || !isOwner) return
    setManagementError('')
    setManaging(true)
    const nextStatus = service.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'
    const { data, error: updateError } = await supabase
      .from('local_service_listings')
      .update({ status: nextStatus })
      .eq('id', service.id)
      .select('id,status')
      .maybeSingle()
    if (updateError || !data) {
      setManagementError('Your service status could not be updated. Please try again.')
    } else {
      setService((current) => ({ ...current, status: data.status }))
    }
    setManaging(false)
  }

  const handleRemoveService = async () => {
    if (!service || !isOwner) return
    setManagementError('')
    setManaging(true)
    const { data, error: updateError } = await supabase
      .from('local_service_listings')
      .update({ status: 'REMOVED' })
      .eq('id', service.id)
      .select('id')
      .maybeSingle()
    if (updateError || !data) {
      setManagementError('Your service could not be removed. Please try again.')
      setManaging(false)
      return
    }
    navigate('/local', { replace: true })
  }

  const handleDeleteService = async () => {
    if (!service || !isOwner) return
    if (service.images?.length) {
      setManagementError('Remove all service images before permanently deleting this service.')
      return
    }
    if (!window.confirm('Permanently delete this service? This cannot be undone.')) return

    setManagementError('')
    setManaging(true)
    const { data, error: deleteError } = await supabase
      .from('local_service_listings')
      .delete()
      .eq('id', service.id)
      .select('id')
      .maybeSingle()
    if (deleteError || !data) {
      setManagementError('Your service could not be permanently deleted. Please try again.')
      setManaging(false)
      return
    }
    navigate('/local', { replace: true })
  }

  const handleDeleteImage = async (image) => {
    if (!service || !isOwner) return
    setManagementError('')
    setManaging(true)
    const { error: storageError } = await supabase.storage.from(IMAGE_BUCKET).remove([image.storage_path])
    if (storageError) {
      setManagementError('That image could not be removed from private storage.')
      setManaging(false)
      return
    }
    const { error: rowError } = await supabase.from('local_service_images').delete().eq('id', image.id)
    if (rowError) {
      setManagementError('The image file was removed, but its listing record could not be updated.')
      setManaging(false)
      await loadService()
      return
    }
    setService((current) => ({ ...current, images: current.images.filter((item) => item.id !== image.id) }))
    setManaging(false)
  }

  const handleAddImages = async (event) => {
    const files = Array.from(event.target.files || [])
    event.target.value = ''
    if (!service || !isOwner || !files.length) return
    if (files.length + (service.images?.length || 0) > 5 || files.some((file) => !IMAGE_TYPES.includes(file.type) || file.size > 5 * 1024 * 1024)) {
      setManagementError('Choose images so this service has no more than 5 JPG, PNG, or WebP files, each up to 5 MB.')
      return
    }

    setManagementError('')
    setManaging(true)
    const uploaded = []
    try {
      for (const [index, file] of files.entries()) {
        const path = `${service.id}/${crypto.randomUUID()}-${safeFileName(file.name)}`
        const { error: uploadError } = await supabase.storage.from(IMAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false })
        if (uploadError) throw new Error('upload')
        uploaded.push({ path, sort_order: (service.images?.length || 0) + index })
      }
      const { data, error: insertError } = await supabase
        .from('local_service_images')
        .insert(uploaded.map((image) => ({ service_id: service.id, storage_path: image.path, sort_order: image.sort_order })))
        .select('id,service_id,storage_path,sort_order,created_at')
      if (insertError) throw new Error('metadata')
      setService((current) => ({ ...current, images: [...(current.images || []), ...(data || [])] }))
    } catch (caughtError) {
      if (uploaded.length) await supabase.storage.from(IMAGE_BUCKET).remove(uploaded.map((image) => image.path))
      setManagementError(caughtError.message === 'upload'
        ? 'One of the images could not be uploaded.'
        : 'Image information could not be saved. Uploaded files were cleaned up.')
    } finally {
      setManaging(false)
    }
  }

  const sortedImages = useMemo(
    () => [...(service?.images || [])].sort((first, second) => first.sort_order - second.sort_order),
    [service?.images],
  )

  return (
    <div className="local-shell">
      <LocalHeader action={{ to: '/local', label: 'Explore Local' }} />
      <main className="local-main local-detail-main">
        <Link to="/local" className="local-back-link">← Back to Local</Link>
        {loading ? <p className="local-status" role="status">Loading service…</p> : null}
        {error ? <div className="local-alert" role="alert">{error}</div> : null}
        {!loading && !error && !service ? (
          <div className="local-empty">
            <span aria-hidden="true">⌖</span>
            <h1>Service not found</h1>
            <p>This service may no longer be available.</p>
            <Link to="/local">Explore Local</Link>
          </div>
        ) : null}
        {!loading && service ? (
          <article className="local-detail">
            <div className="local-detail-gallery">
              {imageError ? <div className="local-alert" role="alert">{imageError}</div> : null}
              {imageUrls.length
                ? imageUrls.map((url) => <img key={url} src={url} alt={service.title} />)
                : <div className="local-detail-placeholder"><span aria-hidden="true">✳</span><span>Service gallery</span></div>}
              {isOwner ? (
                <label className="local-add-images">
                  <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={handleAddImages} disabled={managing} />
                  <span aria-hidden="true">＋</span> Add images
                </label>
              ) : null}
              {isOwner && service.images?.length ? (
                <div className="local-image-management">
                  {sortedImages.map((image, index) => (
                    <button key={image.id} type="button" onClick={() => handleDeleteImage(image)} disabled={managing} aria-label={`Delete service image ${index + 1}`}>
                      Remove image {index + 1}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="local-detail-copy">
              <span className="local-eyebrow">{service.category?.name || 'Local service'}</span>
              <h1>{service.title}</h1>
              <div className="local-detail-provider"><ProviderLabel identity={identity} /><span>Arvion provider</span></div>
              <strong className="local-detail-price">From {formatPrice(service.price_minor, service.currency)}</strong>
              <div className="local-detail-facts">
                <div><span>Service area</span><strong>{formatLocation(service)}</strong></div>
                <div><span>Service status</span><strong>{service.status}</strong></div>
              </div>
              <section className="local-description">
                <h2>About this service</h2>
                <p>{service.description}</p>
              </section>
              <div className="local-booking-note">
                <strong>Have a project in mind?</strong>
                <p>Contact and booking tools are coming in a later Arvion release.</p>
                <button type="button" disabled>Contact provider · Coming soon</button>
              </div>
              {isOwner ? (
                <div className="local-owner-tools">
                  <span>Your service tools</span>
                  <div>
                    <button type="button" onClick={handleStatusChange} disabled={managing || service.status === 'REMOVED'}>
                      {service.status === 'ACTIVE' ? 'Pause service' : 'Activate service'}
                    </button>
                    <button type="button" onClick={handleRemoveService} disabled={managing || service.status === 'REMOVED'}>
                      Remove service
                    </button>
                    <button className="danger" type="button" onClick={handleDeleteService} disabled={managing}>
                      Delete permanently
                    </button>
                  </div>
                </div>
              ) : null}
              {managementError ? <div className="local-alert" role="alert">{managementError}</div> : null}
            </div>
          </article>
        ) : null}
      </main>
    </div>
  )
}
